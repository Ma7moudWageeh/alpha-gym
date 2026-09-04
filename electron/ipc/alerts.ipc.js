const { ipcMain } = require('electron');
const db = require('../db');

/**
 * Expiring Soon rule:
 * Strictly active memberships expiring within 24-48h (days_left is 0 or 1).
 * Negative days (overdue/expired) are strictly excluded.
 * Exclude clients who already have a newer active/future subscription.
 */
ipcMain.handle('alerts:getExpiringSoon', async () => {
  try {
    db.syncAllSubscriptionStatuses(db);
    const today = new Date().toISOString().split('T')[0];

    const subscriptions = db.prepare(`
      SELECT
        s.*,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.client_code,
        p.title as package_title,
        CAST(julianday(DATE(s.end_date)) - julianday(DATE(?)) AS INT) as days_remaining,
        CAST(julianday(DATE(s.end_date)) - julianday(DATE(?)) AS INT) as days_left
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE DATE(s.end_date) >= DATE(?)
        AND DATE(s.end_date) <= DATE(?, '+1 day')
        AND (s.status IS NULL OR s.status != 'expired')
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s2
          WHERE s2.client_id = s.client_id
            AND s2.id != s.id
            AND (
              (s2.status = 'active' AND DATE(s2.end_date) >= DATE(?))
              OR s2.status = 'frozen'
            )
            AND DATE(s2.end_date) > DATE(s.end_date)
        )
      ORDER BY s.end_date ASC
    `).all(today, today, today, today, today);

    return { success: true, subscriptions };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('alerts:getExpired', async (event, { days = 30 } = {}) => {
  try {
    db.syncAllSubscriptionStatuses(db);
    const today = new Date().toISOString().split('T')[0];
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    const subscriptions = db.prepare(`
      SELECT
        s.*,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.client_code,
        p.title as package_title,
        CAST(julianday(DATE(?)) - julianday(DATE(s.end_date)) AS INT) as days_expired
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE (s.status = 'expired' OR (s.status = 'active' AND DATE(s.end_date) < DATE(?)))
        AND DATE(s.end_date) >= DATE(?)
        AND DATE(s.end_date) < DATE(?)
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s2
          WHERE s2.client_id = s.client_id
            AND s2.id != s.id
            AND (
              (s2.status = 'active' AND DATE(s2.end_date) >= DATE(?))
              OR s2.status = 'frozen'
            )
            AND DATE(s2.end_date) > DATE(s.end_date)
        )
      ORDER BY s.end_date DESC
    `).all(today, today, pastDateStr, today, today);

    return { success: true, subscriptions };
  } catch (err) {
    return { error: err.message };
  }
});

function getAllAlertsData() {
  db.syncAllSubscriptionStatuses(db);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const mmdd = `${month}-${day}`;
  const ddmm = `${day}/${month}`;

  const expiringSoon = db.prepare(`
    SELECT
      s.*,
      s.id as subscription_id,
      c.id as client_id,
      c.id as id,
      c.name as client_name,
      c.name as name,
      c.name as full_name,
      c.phone as client_phone,
      c.phone as phone,
      c.client_code,
      c.date_of_birth,
      p.title as package_title,
      CAST(julianday(DATE(s.end_date)) - julianday(DATE(?)) AS INT) as days_remaining,
      CAST(julianday(DATE(s.end_date)) - julianday(DATE(?)) AS INT) as days_left,
      'EXPIRING_SOON' as type
    FROM subscriptions s
    JOIN clients c ON s.client_id = c.id
    LEFT JOIN packages p ON s.package_id = p.id
    WHERE DATE(s.end_date) >= DATE(?)
      AND DATE(s.end_date) <= DATE(?, '+1 day')
      AND (s.status IS NULL OR s.status != 'expired')
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s2
        WHERE s2.client_id = s.client_id
          AND s2.id != s.id
          AND (
            (s2.status = 'active' AND DATE(s2.end_date) >= DATE(?))
            OR s2.status = 'frozen'
          )
          AND DATE(s2.end_date) > DATE(s.end_date)
      )
    ORDER BY s.end_date ASC
  `).all(today, today, today, today, today);

  const expiredToday = db.prepare(`
    SELECT
      s.*,
      s.id as subscription_id,
      c.id as client_id,
      c.id as id,
      c.name as client_name,
      c.name as name,
      c.name as full_name,
      c.phone as client_phone,
      c.phone as phone,
      c.client_code,
      c.date_of_birth,
      s.end_date,
      s.status,
      p.title as package_title,
      'EXPIRED_TODAY' as type
    FROM subscriptions s
    JOIN clients c ON s.client_id = c.id
    LEFT JOIN packages p ON s.package_id = p.id
    WHERE (s.status = 'expired' OR DATE(s.end_date) <= DATE(?))
      AND DATE(s.end_date) = DATE(?)
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s2
        WHERE s2.client_id = s.client_id
          AND s2.id != s.id
          AND (
            (s2.status = 'active' AND DATE(s2.end_date) > DATE(?))
            OR s2.status = 'frozen'
          )
          AND DATE(s2.end_date) > DATE(s.end_date)
      )
    ORDER BY s.end_date DESC
  `).all(today, today);

  const birthdays = db.prepare(`
    SELECT
      id as client_id,
      id,
      name as client_name,
      name,
      name as full_name,
      phone as client_phone,
      phone,
      client_code,
      date_of_birth,
      profile_photo,
      'BIRTHDAY' as type
    FROM clients
    WHERE strftime('%m-%d', date_of_birth) = ?
       OR date_of_birth LIKE ?
       OR date_of_birth LIKE ?
    ORDER BY name ASC
  `).all(mmdd, `%-${mmdd}%`, `${ddmm}%`);

  return {
    success: true,
    expiring_soon: expiringSoon,
    expired_today: expiredToday,
    birthdays: birthdays,
  };
}

ipcMain.handle('alerts:getCounts', async () => {
  try {
    db.syncAllSubscriptionStatuses(db);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const mmdd = `${month}-${day}`;
    const ddmm = `${day}/${month}`;

    const expiringCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM subscriptions s
      WHERE DATE(s.end_date) >= DATE(?)
        AND DATE(s.end_date) <= DATE(?, '+1 day')
        AND (s.status IS NULL OR s.status != 'expired')
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s2
          WHERE s2.client_id = s.client_id
            AND s2.id != s.id
            AND (
              (s2.status = 'active' AND DATE(s2.end_date) >= DATE(?))
              OR s2.status = 'frozen'
            )
            AND DATE(s2.end_date) > DATE(s.end_date)
        )
    `).get(today, today, today);

    const expiredTodayCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      WHERE (s.status = 'expired' OR DATE(s.end_date) <= DATE(?))
        AND DATE(s.end_date) = DATE(?)
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s2
          WHERE s2.client_id = s.client_id
            AND s2.id != s.id
            AND (
              (s2.status = 'active' AND DATE(s2.end_date) > DATE(?))
              OR s2.status = 'frozen'
            )
            AND DATE(s2.end_date) > DATE(s.end_date)
        )
    `).get(today, today);

    const birthdayCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM clients
      WHERE strftime('%m-%d', date_of_birth) = ?
         OR date_of_birth LIKE ?
         OR date_of_birth LIKE ?
    `).get(mmdd, `%-${mmdd}%`, `${ddmm}%`);

    return {
      success: true,
      expiring_soon_count: expiringCountRow.count,
      expired_today_count: expiredTodayCountRow.count,
      birthday_count: birthdayCountRow.count,
      total_alerts: expiringCountRow.count + expiredTodayCountRow.count + birthdayCountRow.count
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('alerts:getAll', async () => {
  try {
    return getAllAlertsData();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('notifications:getAll', async () => {
  try {
    return getAllAlertsData();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('notifications:getTodayBirthdays', async () => {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const mmdd = `${month}-${day}`;
    const ddmm = `${day}/${month}`;

    const rows = db.prepare(`
      SELECT id, id as client_id, name, name as client_name, phone, phone as client_phone, date_of_birth, profile_photo, client_code 
      FROM clients 
      WHERE strftime('%m-%d', date_of_birth) = ? 
         OR date_of_birth LIKE ?
         OR date_of_birth LIKE ?
      ORDER BY name ASC
    `).all(mmdd, `%-${mmdd}%`, `${ddmm}%`);

    return { success: true, birthdays: rows };
  } catch (err) {
    console.error('Failed to get birthdays:', err);
    return { success: false, birthdays: [] };
  }
});

