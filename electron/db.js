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

  // Auto-migration: ensure schema integrity on startup
  function ensureSchemaIntegrity(dbInstance) {
    const safeAddColumn = (table, columnDef) => {
      try {
        dbInstance.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
      } catch (e) {
        // Column already exists or safely ignore
      }
    };

    // Subscriptions Table Migrations
    safeAddColumn('subscriptions', 'is_frozen INTEGER DEFAULT 0');
    safeAddColumn('subscriptions', 'freeze_date TEXT DEFAULT NULL');
    safeAddColumn('subscriptions', 'status TEXT DEFAULT "active"');
    safeAddColumn('subscriptions', 'price REAL DEFAULT 0');
    safeAddColumn('subscriptions', 'paid_amount REAL DEFAULT 0');
    safeAddColumn('subscriptions', 'remaining_amount REAL DEFAULT 0');
    safeAddColumn('subscriptions', 'plan_id INTEGER');
    safeAddColumn('subscriptions', 'duration_days INTEGER DEFAULT 30');
    safeAddColumn('subscriptions', 'is_deferred INTEGER DEFAULT 0');
    safeAddColumn('subscriptions', 'frozen_on TEXT DEFAULT NULL');
    safeAddColumn('subscriptions', 'frozen_days INTEGER DEFAULT 0');
    safeAddColumn('subscriptions', 'freeze_reason TEXT DEFAULT NULL');
    safeAddColumn('subscriptions', 'freeze_mode TEXT DEFAULT NULL');
    safeAddColumn('subscriptions', 'freeze_end_date TEXT DEFAULT NULL');

    // Clients Table Migrations
    safeAddColumn('clients', 'remaining_debt REAL DEFAULT 0');
    safeAddColumn('clients', 'status TEXT DEFAULT "active"');
    safeAddColumn('clients', 'is_frozen INTEGER DEFAULT 0');
    safeAddColumn('clients', 'birth_date TEXT');
    safeAddColumn('clients', 'created_at DATETIME');
    safeAddColumn('clients', 'is_pending_activation INTEGER DEFAULT 0');
    safeAddColumn('clients', 'start_date TEXT');
    safeAddColumn('clients', 'end_date TEXT');
    safeAddColumn('clients', 'freeze_reason TEXT DEFAULT NULL');

    // Transactions Table Migrations
    safeAddColumn('transactions', 'subscription_id INTEGER DEFAULT NULL');
  }

  ensureSchemaIntegrity(db);

  try {
    db.prepare(`
      CREATE VIEW IF NOT EXISTS plans AS 
      SELECT id, title as name, title, default_price as price, default_price, duration_days, is_active, created_at 
      FROM packages
    `).run();
  } catch (e) {}

  // Migration: Table relaxation for subscriptions (allow NULL start_date/end_date)
  try {
    const subTableInfo = db.prepare('PRAGMA table_info(subscriptions)').all();
    const startCol = subTableInfo.find(c => c.name === 'start_date');
    if (startCol && startCol.notnull === 1) {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE subscriptions_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            package_id INTEGER REFERENCES packages(id),
            start_date TEXT,
            end_date TEXT,
            duration_days INTEGER DEFAULT 30,
            price REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            is_deferred INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            frozen_on TEXT,
            frozen_days INTEGER DEFAULT 0,
            freeze_reason TEXT,
            freeze_mode TEXT,
            freeze_end_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO subscriptions_v2 (id, client_id, package_id, start_date, end_date, duration_days, price, paid_amount, remaining_amount, is_deferred, status, frozen_on, frozen_days, freeze_reason, freeze_mode, freeze_end_date, created_at)
          SELECT id, client_id, package_id, start_date, end_date, COALESCE(duration_days, 30), COALESCE(price, 0), COALESCE(paid_amount, 0), COALESCE(remaining_amount, 0), COALESCE(is_deferred, 0), status, frozen_on, frozen_days, freeze_reason, freeze_mode, freeze_end_date, created_at FROM subscriptions;
          DROP TABLE subscriptions;
          ALTER TABLE subscriptions_v2 RENAME TO subscriptions;
        `);
      })();
    }
  } catch (e) {}

  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL,
        amount      REAL    NOT NULL,
        category    TEXT,
        date        TEXT,
        notes       TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS checkins (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id    INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes        TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_checkins_client ON checkins(client_id)`).run();
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
        is_frozen = 0,
        end_date = ?,
        frozen_days = ?,
        freeze_date = NULL,
        frozen_on = NULL,
        freeze_end_date = NULL,
        freeze_mode = NULL,
        freeze_reason = NULL
    WHERE id = ?
  `).run(newEndDate, totalFrozenDays, sub.id);

  if (sub.client_id) {
    target.prepare(`
      UPDATE clients
      SET status = 'active',
          is_frozen = 0,
          end_date = ?
      WHERE id = ?
    `).run(newEndDate, sub.client_id);
  }

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

module.exports.ensureSchemaIntegrity = ensureSchemaIntegrity;
module.exports.syncAllSubscriptionStatuses = syncAllSubscriptionStatuses;
module.exports.unfreezeSubscriptionRecord = unfreezeSubscriptionRecord;
module.exports.addDays = addDays;
module.exports.daysBetween = daysBetween;
