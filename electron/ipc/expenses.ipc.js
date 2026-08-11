const { ipcMain } = require('electron');
const db = require('../db');

function getDateRangeCondition(timeframe) {
  const today = new Date().toISOString().split('T')[0];
  if (timeframe === 'today') {
    return { condition: "date(expense_date) = ?", params: [today] };
  } else if (timeframe === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekAgo = d.toISOString().split('T')[0];
    return { condition: "date(expense_date) >= ?", params: [weekAgo] };
  } else if (timeframe === 'month') {
    const monthStart = today.substring(0, 7) + '-01';
    return { condition: "date(expense_date) >= ?", params: [monthStart] };
  }
  return { condition: "1=1", params: [] };
}

ipcMain.handle('expenses:getAll', async (event, { timeframe = 'all' } = {}) => {
  try {
    const { condition, params } = getDateRangeCondition(timeframe);

    const expenses = db.prepare(`
      SELECT * FROM expenses 
      WHERE ${condition}
      ORDER BY expense_date DESC, id DESC
    `).all(...params);

    return { success: true, expenses };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('expenses:create', async (event, { title, amount, category, description, notes, expense_date }) => {
  try {
    const date = expense_date || new Date().toISOString().split('T')[0];
    const desc = notes || description || null;

    const insert = db.prepare(`
      INSERT INTO expenses (title, amount, category, description, expense_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = insert.run(title, parseFloat(amount), category || 'Miscellaneous', desc, date);
    return { success: true, id: info.lastInsertRowid };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('expenses:delete', async (event, { id, userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can delete expenses.' };
    }

    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
