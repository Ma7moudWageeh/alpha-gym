/**
 * Global date formatting — Alpha Gym enforces DD/MM/YYYY everywhere.
 * Internal storage remains ISO (YYYY-MM-DD) for SQLite / <input type="date">.
 */

function toDateParts(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      day: value.getDate(),
      month: value.getMonth() + 1,
      year: value.getFullYear(),
      hours: value.getHours(),
      minutes: value.getMinutes(),
    };
  }

  const str = String(value).trim();
  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS / ISO
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
      hours: match[4] !== undefined ? parseInt(match[4], 10) : 0,
      minutes: match[5] !== undefined ? parseInt(match[5], 10) : 0,
    };
  }

  // Already DD/MM/YYYY
  const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (dmy) {
    return {
      day: parseInt(dmy[1], 10),
      month: parseInt(dmy[2], 10),
      year: parseInt(dmy[3], 10),
      hours: dmy[4] !== undefined ? parseInt(dmy[4], 10) : 0,
      minutes: dmy[5] !== undefined ? parseInt(dmy[5], 10) : 0,
    };
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Format any date-like value as DD/MM/YYYY */
export function formatDateDDMMYYYY(isoOrDate) {
  const parts = toDateParts(isoOrDate);
  if (!parts) return '';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/** Format datetime as DD/MM/YYYY HH:MM */
export function formatDateTimeDDMMYYYY(ts) {
  const parts = toDateParts(ts);
  if (!parts) return '';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year} ${pad2(parts.hours)}:${pad2(parts.minutes)}`;
}

/**
 * Normalize UI/storage dates to YYYY-MM-DD for SQLite and date inputs.
 * Accepts YYYY-MM-DD or DD/MM/YYYY.
 */
export function parseInputDate(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parts = toDateParts(str);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * Checks if a given DOB string (YYYY-MM-DD or DD/MM/YYYY or ISO) matches today's date (month & day).
 */
export function isBirthdayToday(dobString) {
  if (!dobString) return false;
  const parts = toDateParts(dobString);
  if (!parts) return false;
  const today = new Date();
  return parts.month === (today.getMonth() + 1) && parts.day === today.getDate();
}

/**
 * Checks if a client's birthday is today.
 */
export function isClientBirthdayToday(client) {
  if (!client) return false;
  const dob = client.date_of_birth || client.dob || client.birth_date;
  return isBirthdayToday(dob);
}

/**
 * Checks if a given date string matches today's full date (year, month, day).
 */
export function isTodayDate(dateStr) {
  if (!dateStr) return false;
  const parts = toDateParts(dateStr);
  if (!parts) return false;
  const today = new Date();
  return (
    parts.year === today.getFullYear() &&
    parts.month === (today.getMonth() + 1) &&
    parts.day === today.getDate()
  );
}

export function getTodayStr() {
  return toLocalDateString(new Date());
}

export function addDays(dateInput, days) {
  const baseStr = toLocalDateString(dateInput);
  if (!baseStr) return '';
  const [y, m, d] = baseStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

/**
 * Normalizes any date input to YYYY-MM-DD string in local time to eliminate UTC shift.
 */
export function toLocalDateString(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar-day difference between end date and today:
 * > 0  : Active with N days remaining
 * === 0: Expires today
 * < 0  : Lapsed / expired (e.g. -1 means expired yesterday)
 * null : No subscription / missing end date
 */
export function calculateDaysRemaining(endDateInput) {
  if (!endDateInput) return null;
  const endStr = toLocalDateString(endDateInput);
  const todayStr = toLocalDateString(new Date());
  if (!endStr || !todayStr) return null;

  const [y1, m1, d1] = endStr.split('-').map(Number);
  const [y2, m2, d2] = todayStr.split('-').map(Number);

  const endUtc = Date.UTC(y1, m1 - 1, d1);
  const todayUtc = Date.UTC(y2, m2 - 1, d2);

  return Math.round((endUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Single Source of Truth for Client Lifecycle Status.
 * MUST be imported and utilized uniformly across all components.
 */
export function getClientEffectiveStatus(client) {
  if (!client) return 'INACTIVE';

  const rawClientStatus = String(client.status || '').toLowerCase();
  const rawSubStatus = String(client.subscription_status || client.sub_status || client.activeSubscription?.status || '').toLowerCase();

  // Frozen takes precedence over date calculations
  if (
    rawClientStatus === 'frozen' ||
    rawSubStatus === 'frozen' ||
    client.is_frozen === 1 ||
    client.is_frozen === true ||
    client.subscription_is_frozen === 1 ||
    client.subscription_is_frozen === true ||
    client.activeSubscription?.is_frozen === 1 ||
    client.activeSubscription?.status === 'frozen'
  ) {
    return 'FROZEN';
  }

  const endDate = client.end_date || client.subscription_end || client.latest_end_date || client.activeSubscription?.end_date;
  if (!endDate) return 'NO PLAN';

  const daysRemaining = calculateDaysRemaining(endDate);
  if (daysRemaining === null) return 'NO PLAN';

  if (daysRemaining < 0) {
    return daysRemaining >= -30 ? 'EXPIRED' : 'INACTIVE';
  }

  return 'ACTIVE';
}

/**
 * Determines whether a client was registered today.
 * Returns true strictly if created today AND not expired/inactive.
 */
export function isNewClientToday(client) {
  const createdDate = client?.created_at || client?.registered_at;
  if (!createdDate) return false;
  const createdStr = toLocalDateString(createdDate);
  const todayStr = toLocalDateString(new Date());
  if (createdStr !== todayStr) return false;

  const status = getClientEffectiveStatus(client);
  return status !== 'EXPIRED' && status !== 'INACTIVE' && status !== 'FROZEN';
}

/**
 * Resolves the dynamic glow ring and border for client avatars
 * based on the strict lifecycle hierarchy:
 * 1. Birthday Today (Gold / 1 Day Only)
 * 2. Frozen Subscription (Ice-Cyan / Cyan Glow)
 * 3. Expired Subscription within 30 days (Rose Red)
 * 4. Expiring Soon - Exactly 1 day remaining (Deep Orange)
 * 5. New Client Registered Today (Pure White)
 */
export function getAvatarGlowClass(client) {
  if (!client) return "";

  // Priority 1: Birthday Today (Gold)
  if (isClientBirthdayToday(client)) {
    return "ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.35)] border-transparent";
  }

  const status = getClientEffectiveStatus(client);

  // Priority 2: Frozen Subscription (Ice-Blue / Cyan Glow)
  if (status === 'FROZEN') {
    return 'ring-2 ring-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.4)] border-cyan-400 text-cyan-300';
  }

  // Priority 3: Expired Subscription within 30 days (Rose Red)
  if (status === 'EXPIRED') {
    return "ring-2 ring-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] border-transparent";
  }

  // Priority 4: Expiring Soon - Exactly 1 day remaining (Deep Orange)
  const endDate = client.end_date || client.subscription_end || client.latest_end_date || client.activeSubscription?.end_date;
  const daysRemaining = calculateDaysRemaining(endDate);
  if (status === 'ACTIVE' && daysRemaining === 1) {
    return "ring-2 ring-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.4)] border-transparent";
  }

  // Priority 5: New Client Registered Today (Pure White)
  if (isNewClientToday(client)) {
    return "ring-2 ring-white shadow-[0_0_14px_rgba(255,255,255,0.45)] border-transparent";
  }

  return "";
}

export default {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  parseInputDate,
  isBirthdayToday,
  isClientBirthdayToday,
  isTodayDate,
  toLocalDateString,
  getTodayStr,
  addDays,
  calculateDaysRemaining,
  getClientEffectiveStatus,
  isNewClientToday,
  getAvatarGlowClass,
};
