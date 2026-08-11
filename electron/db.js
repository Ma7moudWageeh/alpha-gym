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


// Central auto-expiration sync
function syncAllSubscriptionStatuses(db) {
  try {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active'").run();
  } catch (err) {
    console.error('Failed to sync statuses:', err);
  }
}

module.exports.syncAllSubscriptionStatuses = syncAllSubscriptionStatuses;
