/**
 * whatsapp.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilities for:
 *   • Formatting Egyptian phone numbers to international format
 *   • Building wa.me deep-link URLs
 *   • Compiling admin-configured message templates
 *   • Auto-detecting client status and dispatching the right WhatsApp message
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isBirthdayToday, isTodayDate } from './dateFormat';
export { isBirthdayToday, isTodayDate }; // re-export for any legacy callers

// ─── 1. PHONE FORMATTING ─────────────────────────────────────────────────────

const EGYPTIAN_LOCAL_PREFIXES = ['010', '011', '012', '015'];

/**
 * Sanitize a raw phone string and convert local Egyptian numbers to
 * international format (without leading "+").
 *
 * Rules:
 *  - Strip all non-digit characters.
 *  - 010/011/012/015 prefix  → prepend country code "2"  (01012345678 → 201012345678)
 *  - Already starts with "20"  → return as-is
 *  - Unknown format            → return digits unchanged (let the caller decide)
 *  - Empty / null              → return null
 *
 * @param {string} rawPhone
 * @returns {string|null}
 */
export function formatEgyptianPhone(rawPhone) {
  if (!rawPhone) return null;

  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('20')) return digits;

  if (EGYPTIAN_LOCAL_PREFIXES.some((prefix) => digits.startsWith(prefix))) {
    return `2${digits}`;
  }

  return digits;
}

// ─── 2. URL BUILDER ──────────────────────────────────────────────────────────

/**
 * Build a wa.me deep-link URL for the given raw phone number.
 *
 * @param {string}  rawPhone
 * @param {string}  [message]  - Optional pre-filled message (URI-encoded automatically).
 * @returns {string|null}
 */
export function buildWhatsAppUrl(rawPhone, message = '') {
  const phone = formatEgyptianPhone(rawPhone);
  if (!phone) return null;

  const base = `https://wa.me/${phone}`;
  if (!message) return base;

  return `${base}?text=${encodeURIComponent(message)}`;
}

// ─── 3. SHELL BRIDGE ─────────────────────────────────────────────────────────

/**
 * Open WhatsApp for the given phone number through the Electron shell bridge.
 * Returns false gracefully when the API is unavailable.
 *
 * @param {string}  rawPhone
 * @param {string}  [message]
 * @returns {Promise<boolean>}
 */
export async function openWhatsApp(rawPhone, message = '') {
  const url = buildWhatsAppUrl(rawPhone, message);
  if (!url) return false;

  try {
    const result = await window.electronAPI.openExternalUrl(url);
    return result?.success === true;
  } catch {
    return false;
  }
}

// ─── 4. TEMPLATE COMPILATION ─────────────────────────────────────────────────

/**
 * Replace all dynamic placeholders in a template string with real client data.
 *
 * Supported placeholders:
 *   {name}    → client.full_name  || client.name       || ''
 *   {package} → client.package_name || client.packageName || client.plan || ''
 *   {days}    → client.days_left  ?? client.daysLeft   ?? ''
 *
 * @param {string}        template
 * @param {object}        client
 * @returns {string}
 */
export function compileTemplate(template, client = {}) {
  if (!template) return '';

  const name    = String(client.full_name   ?? client.name        ?? '');
  const pkg     = String(client.package_name ?? client.packageName ?? client.plan ?? '');
  const days    = client.days_left !== undefined
    ? String(client.days_left)
    : client.daysLeft !== undefined
      ? String(client.daysLeft)
      : '';

  return template
    .replace(/\{name\}/g,    name)
    .replace(/\{package\}/g, pkg)
    .replace(/\{days\}/g,    days)
    .trim();
}


// ─── 6. STATUS PRIORITY ENGINE ────────────────────────────────────────────────

/**
 * Determine the best WhatsApp template for a client and compile it.
 *
 * Priority:
 *  1. Explicit contextOverride  ('WELCOME' | 'BIRTHDAY' | 'EXPIRING' | 'EXPIRED')
 *     - 'DEFAULT' | 'NONE'     → '' (Clean chat, NO template)
 *  2. If contextOverride is 'AUTO':
 *     - Birthday today          (date_of_birth / dob matches today's month+day)
 *     - Expired membership      (status === 'EXPIRED'  or days_left <= 0)
 *     - Expiring soon           (status === 'EXPIRING' or 0 < days_left <= 3)
 *  3. Default                   → '' (Clean chat, no prefilled text)
 *
 * @param {object}      client
 * @param {object}      templates         - Shape: { wa_template_birthday, wa_template_expiring, wa_template_expired, wa_template_welcome }
 * @param {string|null} contextOverride   - One of 'DEFAULT' | 'NONE' | 'WELCOME' | 'BIRTHDAY' | 'EXPIRING' | 'EXPIRED' | 'AUTO' | null
 * @returns {string}   Compiled, ready-to-send message, or '' if nothing applies.
 */
export function resolveClientMessage(client = {}, templates = {}, contextOverride = "DEFAULT") {
  const ctx = String(contextOverride || "DEFAULT").toUpperCase();

  // 1. DEFAULT / NONE: Strict clean chat without prefilled message
  if (ctx === "DEFAULT" || ctx === "NONE") {
    return '';
  }

  // 2. Explicit contextual templates
  switch (ctx) {
    case 'WELCOME':
      return compileTemplate(templates.wa_template_welcome || '', client);
    case 'BIRTHDAY':
      return compileTemplate(templates.wa_template_birthday || '', client);
    case 'EXPIRING':
      return compileTemplate(templates.wa_template_expiring || '', client);
    case 'EXPIRED':
      return compileTemplate(templates.wa_template_expired || '', client);
    case 'AUTO':
      break;
    default:
      return '';
  }

  // 3. Auto-detection only if explicitly requested via 'AUTO'
  const dob = client.date_of_birth || client.dob || null;
  if (isBirthdayToday(dob)) {
    return compileTemplate(templates.wa_template_birthday || '', client);
  }

  const daysLeft    = client.days_left ?? client.daysLeft;
  const statusUpper = String(client.status || '').toUpperCase();

  if (statusUpper === 'EXPIRED' || (daysLeft !== undefined && daysLeft !== null && Number(daysLeft) <= 0)) {
    return compileTemplate(templates.wa_template_expired || '', client);
  }

  if (
    statusUpper === 'EXPIRING' ||
    (daysLeft !== undefined && daysLeft !== null && Number(daysLeft) > 0 && Number(daysLeft) <= 3)
  ) {
    return compileTemplate(templates.wa_template_expiring || '', client);
  }

  return '';
}

// ─── 7. UNIFIED ONE-CLICK DISPATCHER ─────────────────────────────────────────

/**
 * The single entry-point for opening WhatsApp for any client from any UI context.
 *
 * Steps:
 *  1. Validate the client's phone number.
 *  2. Check for DEFAULT / NONE clean chat (no template needed).
 *  3. Otherwise resolve + compile the specific contextual template.
 *  4. Launch WhatsApp URL via shell bridge.
 *
 * @param {object}      options
 * @param {object}      options.client           - Client record from the database.
 * @param {string|null} [options.contextOverride] - Force a specific template context ('DEFAULT', 'EXPIRED', etc.).
 * @param {object|null} [options.templates]       - Pre-fetched templates (skips DB call if provided).
 * @returns {Promise<boolean>}  true on success, false on validation failure.
 */
export async function openClientWhatsApp({ client, contextOverride = "DEFAULT", templates = null }) {
  const phone = formatEgyptianPhone(client?.phone);
  if (!phone) {
    console.warn('[openClientWhatsApp] No valid phone number for client:', client?.id ?? client?.name ?? '?');
    return false;
  }

  const ctx = String(contextOverride || "DEFAULT").toUpperCase();

  // 1. DEFAULT / BLANK CHAT: Open clean wa.me/<phone> with no message
  if (ctx === "DEFAULT" || ctx === "NONE") {
    return openWhatsApp(client.phone, '');
  }

  // 2. Fetch templates for contextual messages
  let resolvedTemplates = templates;
  if (!resolvedTemplates) {
    try {
      const res = await window.electronAPI.settings.getWhatsAppTemplates();
      resolvedTemplates = res?.success ? res : {};
    } catch {
      resolvedTemplates = {};
    }
  }

  // 3. Resolve and compile the specific template
  const message = resolveClientMessage(client, resolvedTemplates, ctx);

  // 4. Launch WhatsApp with encoded template
  return openWhatsApp(client.phone, message);
}
