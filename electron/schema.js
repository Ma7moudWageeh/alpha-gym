const db = require('./db');

function initSchema(dbInstance = db) {
  const target = dbInstance || db;
  target.exec(`
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
      remaining_debt  REAL DEFAULT 0,
      is_pending_activation INTEGER DEFAULT 0,
      start_date      TEXT,
      end_date        TEXT,
      status          TEXT DEFAULT 'active',
      registered_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      package_id  INTEGER REFERENCES packages(id),
      start_date  TEXT,
      end_date    TEXT,
      duration_days INTEGER DEFAULT 30,
      price       REAL    DEFAULT 0,
      paid_amount REAL    DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      is_deferred INTEGER DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'active',
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

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      category    TEXT,
      date        TEXT,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read, is_dismissed);
  `);

  // Seed WhatsApp template keys with empty strings if not present
  const waKeys = ['wa_template_birthday', 'wa_template_expiring', 'wa_template_expired', 'wa_template_welcome'];
  const seedSetting = target.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')`);
  for (const key of waKeys) seedSetting.run(key);

  // Clean up any legacy licensing/activation keys from settings table
  try {
    target.prepare(`
      DELETE FROM settings 
      WHERE key IN ('license_key', 'activation_status', 'machine_id', 'machine_guid', 'trial_expires_at', 'trial_start', 'is_activated', 'activation_date')
    `).run();
  } catch (e) {
    // Table or keys might not exist
  }

  try {
    target.prepare("ALTER TABLE packages ADD COLUMN description TEXT").run();
  } catch (e) {
    // Column might already exist, ignore
  }

  try {
    target.prepare("ALTER TABLE clients ADD COLUMN client_code TEXT").run();
    target.prepare("ALTER TABLE clients ADD COLUMN emergency_contact TEXT").run();
    target.prepare("ALTER TABLE clients ADD COLUMN national_id TEXT").run();
    target.prepare("ALTER TABLE clients ADD COLUMN gender TEXT").run();
    target.prepare("ALTER TABLE clients ADD COLUMN notes TEXT").run();
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
    try { target.prepare(sql).run(); } catch (e) { /* already exists */ }
  }

  try {
    target.prepare("ALTER TABLE expenses ADD COLUMN category TEXT").run();
  } catch (e) {
    // Column might already exist, ignore
  }

  // Migration: per-user security PIN for password recovery
  try {
    target.prepare('ALTER TABLE users ADD COLUMN security_pin TEXT').run();
  } catch (e) {
    // Column might already exist
  }
  try {
    target.prepare(`
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
    try { target.prepare(sql).run(); } catch (e) { /* already exists */ }
  }

  // Migration: Debt tracking & settlement
  const addColumnIfNotExists = (table, columnDef) => {
    try {
      target.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
    } catch (error) {
      if (!error.message.includes("duplicate column name")) {
        console.error(`Migration error on ${table}:`, error.message);
      }
    }
  };

  addColumnIfNotExists("clients", "remaining_debt REAL DEFAULT 0");
  addColumnIfNotExists("clients", "birth_date TEXT");
  addColumnIfNotExists("clients", "created_at DATETIME");
  addColumnIfNotExists("subscriptions", "plan_id INTEGER");
  addColumnIfNotExists("subscriptions", "price REAL DEFAULT 0");
  addColumnIfNotExists("subscriptions", "paid_amount REAL DEFAULT 0");
  addColumnIfNotExists("subscriptions", "remaining_amount REAL DEFAULT 0");
  addColumnIfNotExists("subscriptions", "duration_days INTEGER DEFAULT 30");
  addColumnIfNotExists("subscriptions", "is_deferred INTEGER DEFAULT 0");
  addColumnIfNotExists("clients", "is_pending_activation INTEGER DEFAULT 0");
  addColumnIfNotExists("clients", "start_date TEXT");
  addColumnIfNotExists("clients", "end_date TEXT");
  addColumnIfNotExists("clients", "status TEXT DEFAULT 'active'");

  try {
    target.prepare(`
      CREATE VIEW IF NOT EXISTS plans AS 
      SELECT id, title as name, title, default_price as price, default_price, duration_days, is_active, created_at 
      FROM packages
    `).run();
  } catch (e) {}

  // Migration: Table relaxation for subscriptions (allow NULL start_date/end_date and PENDING_ACTIVATION status)
  try {
    const subTableInfo = target.prepare('PRAGMA table_info(subscriptions)').all();
    const startCol = subTableInfo.find(c => c.name === 'start_date');
    if (startCol && startCol.notnull === 1) {
      target.transaction(() => {
        target.exec(`
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
  } catch (e) {
    // Migration handled
  }

  // Checkins table for gym attendance & deferred activation
  try {
    target.prepare(`
      CREATE TABLE IF NOT EXISTS checkins (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id    INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes        TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    target.prepare(`CREATE INDEX IF NOT EXISTS idx_checkins_client ON checkins(client_id)`).run();
  } catch (e) {}

  const pkgCount = target.prepare('SELECT COUNT(*) AS count FROM packages').get().count;
  if (pkgCount === 0) {
    const insertPkg = target.prepare('INSERT INTO packages (title, duration_days, default_price) VALUES (?, ?, ?)');
    const insertTransaction = target.transaction(() => {
      insertPkg.run('1 Month', 30, 200);
      insertPkg.run('3 Months', 90, 500);
      insertPkg.run('Annual', 365, 1500);
    });
    insertTransaction();
  }

  // Sanitize any missing or empty client codes to enforce unique constraint safety
  sanitizeClientCodes(target);
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
