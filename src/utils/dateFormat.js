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

/**
 * Resolves the dynamic glow ring and border for client avatars
 * based on the strict lifecycle hierarchy:
 * 1. Birthday Today (Gold / 1 Day Only)
 * 2. New Client (Glowing White / Day 1 Only)
 * 3. Expiring Soon (Amber Orange / 1 Day Only)
 * 4. Expired (Rose Red / Active until renewed within 30-day window)
 * 5. Default Active/Inactive (Neutral Slate)
 */
export function getAvatarGlowClass(client) {
  if (!client) return "border border-slate-800 ring-0 shadow-none";

  // 1. Birthday Today (Celebratory Top Priority)
  if (isBirthdayToday(client.date_of_birth)) {
    return "ring-2 ring-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.35)] border-transparent";
  }

  const daysLeft = client.days_left !== undefined && client.days_left !== null
    ? Number(client.days_left)
    : client.days_remaining !== undefined && client.days_remaining !== null
      ? Number(client.days_remaining)
      : null;

  const subStatus = String(client.sub_status ?? client.status ?? "").toLowerCase();
  const compStatus = String(client.computed_status ?? "").toUpperCase();

  const isOverdue = subStatus === "expired" || compStatus === "EXPIRED" || (daysLeft !== null && daysLeft <= 0);
  const isWithin30Days = daysLeft === null || (Math.abs(daysLeft) <= 30 && daysLeft >= -30);

  // 2. Expired (Must take precedence over New Client if membership is already lapsed)
  if (isOverdue && isWithin30Days) {
    return "ring-2 ring-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] border-transparent";
  }

  // 3. Expiring Soon (1 Day Remaining)
  if (daysLeft === 1) {
    return "ring-2 ring-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.4)] border-transparent";
  }

  // 4. New Client (Only eligible if NOT expired/overdue)
  const registrationDate = client.created_at || client.registered_at || client.join_date;
  if (registrationDate && isTodayDate(registrationDate) && !isOverdue) {
    return "ring-2 ring-white shadow-[0_0_14px_rgba(255,255,255,0.45)] border-transparent";
  }

  // 5. Default Neutral State
  return "border border-slate-800 ring-0 shadow-none";
}

export default {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  parseInputDate,
  isBirthdayToday,
  isTodayDate,
  getAvatarGlowClass,
};

