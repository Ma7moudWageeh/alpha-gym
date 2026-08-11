const { ipcMain } = require('electron');
const db = require('../db');

ipcMain.handle('alerts:getExpiringSoon', async (event, { days = 7 } = {}) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const subscriptions = db.prepare(`
      SELECT 
        s.*,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.client_code,
        p.title as package_title,
        CAST(julianday(s.end_date) - julianday(?) AS INT) as days_remaining
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.status = 'active' 
        AND s.end_date >= ? 
        AND s.end_date <= ?
      ORDER BY s.end_date ASC
    `).all(today, today, targetDateStr);

    return { success: true, subscriptions };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('alerts:getExpired', async (event, { days = 30 } = {}) => {
  try {
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
        CAST(julianday(?) - julianday(s.end_date) AS INT) as days_expired
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE (s.status = 'expired' OR (s.status = 'active' AND s.end_date < ?))
        AND s.end_date >= ?
      ORDER BY s.end_date DESC
    `).all(today, today, pastDateStr);

    return { success: true, subscriptions };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('alerts:getCounts', async (event, { expiringDays = 3, expiredDays = 1 } = {}) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + expiringDays);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const expiringCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM subscriptions s
      WHERE s.status = 'active' 
        AND s.end_date >= ? 
        AND s.end_date <= ?
    `).get(today, targetDateStr);

    const expiredTodayCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM subscriptions s
      WHERE s.end_date = ?
    `).get(today);

    const birthdayCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM clients
      WHERE strftime('%m-%d', date_of_birth) = strftime('%m-%d', 'now')
    `).get();

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
    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const expiringSoon = db.prepare(`
      SELECT 
        s.*,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.client_code,
        p.title as package_title,
        CAST(julianday(s.end_date) - julianday(?) AS INT) as days_remaining
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.status = 'active' 
        AND s.end_date >= ? 
        AND s.end_date <= ?
      ORDER BY s.end_date ASC
    `).all(today, today, targetDateStr);

    const expiredToday = db.prepare(`
      SELECT 
        s.*,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.client_code,
        p.title as package_title
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.end_date = ?
      ORDER BY s.end_date DESC
    `).all(today);

    const birthdays = db.prepare(`
      SELECT 
        id as client_id,
        name as client_name,
        phone as client_phone,
        client_code,
        date_of_birth
      FROM clients
      WHERE strftime('%m-%d', date_of_birth) = strftime('%m-%d', 'now')
      ORDER BY name ASC
    `).all();

    return {
      success: true,
      expiring_soon: expiringSoon,
      expired_today: expiredToday,
      birthdays: birthdays
    };
  } catch (err) {
    return { error: err.message };
  }
});
