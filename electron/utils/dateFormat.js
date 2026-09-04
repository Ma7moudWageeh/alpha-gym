/**
 * Shared date helpers for Electron main process (print, CSV, etc.)
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

function formatDateDDMMYYYY(isoOrDate) {
  const parts = toDateParts(isoOrDate);
  if (!parts) return '';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

function formatDateTimeDDMMYYYY(ts) {
  const parts = toDateParts(ts);
  if (!parts) return '';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year} ${pad2(parts.hours)}:${pad2(parts.minutes)}`;
}

module.exports = {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
};
