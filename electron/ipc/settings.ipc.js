const { ipcMain } = require('electron');
const db = require('../db');

const TEMPLATE_KEYS = [
  'wa_template_birthday',
  'wa_template_expiring',
  'wa_template_expired',
  'wa_template_welcome',
];

// Ensure settings table exists (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// Seed template rows with empty strings if they don't exist yet
const insertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')`
);
for (const key of TEMPLATE_KEYS) {
  insertSetting.run(key);
}

// ── GET ──────────────────────────────────────────────────────────────────────
ipcMain.handle('settings:getWhatsAppTemplates', () => {
  try {
    const rows = db
      .prepare(`SELECT key, value FROM settings WHERE key IN (${TEMPLATE_KEYS.map(() => '?').join(',')})`)
      .all(...TEMPLATE_KEYS);

    const result = Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, '']));
    for (const row of rows) result[row.key] = row.value ?? '';
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── SAVE ─────────────────────────────────────────────────────────────────────
ipcMain.handle('settings:saveWhatsAppTemplates', (_event, templates = {}) => {
  try {
    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    const saveAll = db.transaction(() => {
      for (const key of TEMPLATE_KEYS) {
        upsert.run(key, typeof templates[key] === 'string' ? templates[key] : '');
      }
    });

    saveAll();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
