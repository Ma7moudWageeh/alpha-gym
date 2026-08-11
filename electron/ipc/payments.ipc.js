const { ipcMain } = require('electron');
const db = require('../db');

function getDateRangeCondition(timeframe) {
  const today = new Date().toISOString().split('T')[0];
  if (timeframe === 'today') {
    return { condition: "date(p.paid_at) = ?", params: [today] };
  } else if (timeframe === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekAgo = d.toISOString().split('T')[0];
    return { condition: "date(p.paid_at) >= ?", params: [weekAgo] };
  } else if (timeframe === 'month') {
    const monthStart = today.substring(0, 7) + '-01';
    return { condition: "date(p.paid_at) >= ?", params: [monthStart] };
  }
  return { condition: "1=1", params: [] };
}

ipcMain.handle('payments:getAll', async (event, { timeframe = 'all' } = {}) => {
  try {
    const { condition, params } = getDateRangeCondition(timeframe);

    const payments = db.prepare(`
      SELECT 
        p.*,
        c.name as client_name,
        c.client_code,
        pkg.title as package_title
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN packages pkg ON s.package_id = pkg.id
      WHERE ${condition}
      ORDER BY p.paid_at DESC
    `).all(...params);

    return { success: true, payments };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('payments:getByClient', async (event, { client_id }) => {
  try {
    const payments = db.prepare(`
      SELECT 
        p.*,
        pkg.title as package_title,
        s.start_date as sub_start_date,
        s.end_date as sub_end_date
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN packages pkg ON s.package_id = pkg.id
      WHERE p.client_id = ?
      ORDER BY p.paid_at DESC
    `).all(client_id);
    return { success: true, payments };
  } catch (err) {
    return { error: err.message };
  }
});
