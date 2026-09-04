const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : process.cwd();
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, 'alpha-gym.db');
let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Auto-migrate legacy 'overdue' statuses to 'expired'
  try {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE UPPER(status) = 'OVERDUE'").run();
  } catch (e) {}

  try {
    db.prepare("UPDATE clients SET status = 'expired' WHERE UPPER(status) = 'OVERDUE'").run();
  } catch (e) {}

} catch (err) {
  console.error('Failed to initialize database:', err);
}

module.exports = db;

function addDays(dateStr, days) {
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(String(fromDateStr).slice(0, 10) + 'T00:00:00');
  const to = new Date(String(toDateStr).slice(0, 10) + 'T00:00:00');
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

/**
 * Apply unfreeze math: shift end_date by actual elapsed freeze days only.
 * Timed freezes are capped to the originally requested N days.
 */
function unfreezeSubscriptionRecord(target, sub, today) {
  const frozenOn = String(sub.frozen_on || today).slice(0, 10);
  let daysElapsed = daysBetween(frozenOn, today);

  if (sub.freeze_mode === 'timed' && sub.freeze_end_date) {
    const requestedDays = daysBetween(frozenOn, String(sub.freeze_end_date).slice(0, 10));
    daysElapsed = Math.min(daysElapsed, requestedDays);
  }

  const newEndDate = addDays(sub.end_date, daysElapsed);
  const totalFrozenDays = (sub.frozen_days || 0) + daysElapsed;

  target.prepare(`
    UPDATE subscriptions
    SET status = 'active',
        end_date = ?,
        frozen_days = ?,
        frozen_on = NULL,
        freeze_end_date = NULL,
        freeze_mode = NULL,
        freeze_reason = NULL
    WHERE id = ?
  `).run(newEndDate, totalFrozenDays, sub.id);

  return { end_date: newEndDate, added_days: daysElapsed };
}

// Central auto-expiration + timed freeze sync
function syncAllSubscriptionStatuses(dbInstance) {
  const target = dbInstance || db;
  try {
    const today = new Date().toISOString().split('T')[0];

    // Auto-unfreeze timed freezes whose freeze_end_date has elapsed
    const due = target.prepare(`
      SELECT * FROM subscriptions
      WHERE status = 'frozen'
        AND freeze_mode = 'timed'
        AND freeze_end_date IS NOT NULL
        AND DATE(freeze_end_date) <= DATE('now', 'localtime')
    `).all();

    for (const sub of due) {
      unfreezeSubscriptionRecord(target, sub, today);
    }

    // Auto-expire active subscriptions past end_date
    target.prepare(`
      UPDATE subscriptions
      SET status = 'expired'
      WHERE DATE(end_date) < DATE('now', 'localtime')
        AND status = 'active'
    `).run();
  } catch (err) {
    console.error('Failed to sync statuses:', err);
  }
}

module.exports.syncAllSubscriptionStatuses = syncAllSubscriptionStatuses;
module.exports.unfreezeSubscriptionRecord = unfreezeSubscriptionRecord;
module.exports.addDays = addDays;
module.exports.daysBetween = daysBetween;
