const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name   TEXT    NOT NULL,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('owner','admin')),
      master_pin  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      description   TEXT,
      duration_days INTEGER NOT NULL,
      default_price REAL    NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      phone           TEXT    NOT NULL,
      date_of_birth   TEXT,
      height_cm       REAL,
      weight_kg       REAL    NOT NULL,
      area            TEXT,
      other_sports    TEXT,
      injuries        TEXT,
      has_conditions  INTEGER NOT NULL DEFAULT 0,
      medical_details TEXT,
      client_code     TEXT UNIQUE,
      emergency_contact TEXT,
      national_id     TEXT,
      gender          TEXT,
      notes           TEXT,
      registered_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      package_id  INTEGER REFERENCES packages(id),
      start_date  TEXT    NOT NULL,
      end_date    TEXT    NOT NULL,
      price       REAL    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active','frozen','expired')),
      frozen_on   TEXT,
      frozen_days INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id),
      amount          REAL    NOT NULL,
      type            TEXT    NOT NULL DEFAULT 'subscription',
      note            TEXT,
      paid_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS body_progress (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      weight_kg   REAL,
      notes       TEXT,
      logged_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      category    TEXT,
      description TEXT,
      expense_date TEXT   NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL CHECK(type IN ('expiry','birthday')),
      priority    TEXT    NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high')),
      is_read     INTEGER NOT NULL DEFAULT 0,
      is_dismissed INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read, is_dismissed);
  `);

  try {
    db.prepare("ALTER TABLE packages ADD COLUMN description TEXT").run();
  } catch (e) {
    // Column might already exist, ignore
  }

  try {
    db.prepare("ALTER TABLE clients ADD COLUMN client_code TEXT").run();
    db.prepare("ALTER TABLE clients ADD COLUMN emergency_contact TEXT").run();
    db.prepare("ALTER TABLE clients ADD COLUMN national_id TEXT").run();
    db.prepare("ALTER TABLE clients ADD COLUMN gender TEXT").run();
    db.prepare("ALTER TABLE clients ADD COLUMN notes TEXT").run();
  } catch (e) {
    // Columns might already exist, ignore
  }

  // Migration: additional client fields for new form
  const clientMigrations = [
    "ALTER TABLE clients ADD COLUMN area TEXT",
    "ALTER TABLE clients ADD COLUMN other_sports TEXT",
    "ALTER TABLE clients ADD COLUMN injuries TEXT",
    "ALTER TABLE clients ADD COLUMN medical_details TEXT",
    "ALTER TABLE clients ADD COLUMN profile_photo TEXT",
  ];
  for (const sql of clientMigrations) {
    try { db.prepare(sql).run(); } catch (e) { /* already exists */ }
  }

  try {
    db.prepare("ALTER TABLE expenses ADD COLUMN category TEXT").run();
  } catch (e) {
    // Column might already exist, ignore
  }

  // Migration: per-user security PIN for password recovery
  try {
    db.prepare('ALTER TABLE users ADD COLUMN security_pin TEXT').run();
  } catch (e) {
    // Column might already exist
  }
  try {
    db.prepare(`
      UPDATE users
      SET security_pin = master_pin
      WHERE security_pin IS NULL AND master_pin IS NOT NULL
    `).run();
  } catch (e) {
    // Ignore migration errors
  }

  // Migration: dual-mode freeze fields on subscriptions
  const freezeMigrations = [
    'ALTER TABLE subscriptions ADD COLUMN freeze_reason TEXT',
    "ALTER TABLE subscriptions ADD COLUMN freeze_mode TEXT",
    'ALTER TABLE subscriptions ADD COLUMN freeze_end_date TEXT',
  ];
  for (const sql of freezeMigrations) {
    try { db.prepare(sql).run(); } catch (e) { /* already exists */ }
  }

  const pkgCount = db.prepare('SELECT COUNT(*) AS count FROM packages').get().count;
  if (pkgCount === 0) {
    const insertPkg = db.prepare('INSERT INTO packages (title, duration_days, default_price) VALUES (?, ?, ?)');
    const insertTransaction = db.transaction(() => {
      insertPkg.run('1 Month', 30, 200);
      insertPkg.run('3 Months', 90, 500);
      insertPkg.run('Annual', 365, 1500);
    });
    insertTransaction();
  }

  // Sanitize any missing or empty client codes to enforce unique constraint safety
  sanitizeClientCodes(db);
}

function generateNextClientCode(dbInstance = db) {
  const rows = dbInstance.prepare(`
    SELECT client_code 
    FROM clients 
    WHERE client_code IS NOT NULL AND client_code != ''
  `).all();

  let maxNumber = 0;
  for (const row of rows) {
    const numbers = String(row.client_code).match(/\d+/g);
    if (numbers) {
      const parsed = parseInt(numbers[numbers.length - 1], 10);
      if (!isNaN(parsed) && parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  }

  let nextNum = maxNumber + 1;
  let nextCode = `AG-${String(nextNum).padStart(4, '0')}`;

  while (dbInstance.prepare('SELECT 1 FROM clients WHERE client_code = ?').get(nextCode)) {
    nextNum++;
    nextCode = `AG-${String(nextNum).padStart(4, '0')}`;
  }

  return nextCode;
}

function sanitizeClientCodes(dbInstance = db) {
  try {
    const emptyCodeRows = dbInstance.prepare("SELECT id FROM clients WHERE client_code = '' OR client_code IS NULL").all();
    for (const row of emptyCodeRows) {
      const freshCode = generateNextClientCode(dbInstance);
      dbInstance.prepare('UPDATE clients SET client_code = ? WHERE id = ?').run(freshCode, row.id);
    }
  } catch (e) {
    console.error('Error sanitizing client codes:', e);
  }
}

module.exports = { initSchema, generateNextClientCode, sanitizeClientCodes };
