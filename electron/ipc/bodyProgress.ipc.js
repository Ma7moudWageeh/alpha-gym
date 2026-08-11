const { ipcMain } = require('electron');
const db = require('../db');

ipcMain.handle('bodyProgress:getByClient', async (event, { client_id }) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM body_progress 
      WHERE client_id = ? 
      ORDER BY logged_at DESC, id DESC
    `).all(client_id);
    
    return { success: true, entries };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('bodyProgress:add', async (event, { client_id, weight_kg, notes, recorded_at }) => {
  try {
    const loggedAt = recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = db.transaction(() => {
      const res = db.prepare(`
        INSERT INTO body_progress (client_id, weight_kg, notes, logged_at)
        VALUES (?, ?, ?, ?)
      `).run(client_id, parseFloat(weight_kg), notes || null, loggedAt);

      // Update current weight in client record
      db.prepare(`
        UPDATE clients SET weight_kg = ? WHERE id = ?
      `).run(parseFloat(weight_kg), client_id);

      return res.lastInsertRowid;
    })();

    return { success: true, id: result };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('bodyProgress:delete', async (event, { id }) => {
  try {
    db.prepare('DELETE FROM body_progress WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
