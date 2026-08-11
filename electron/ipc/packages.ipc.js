const { ipcMain } = require('electron');
const db = require('../db');

ipcMain.handle('packages:getAll', async () => {
  try {
    const packages = db.prepare('SELECT * FROM packages ORDER BY is_active DESC, default_price ASC').all();
    return { success: true, packages };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('packages:getById', async (event, { id }) => {
  try {
    const package = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
    if (!package) return { error: 'Package not found' };
    return { success: true, package };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('packages:create', async (event, { title, duration_days, default_price, description, userRole }) => {
  try {
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can create membership packages.' };
    }

    const insert = db.prepare(`
      INSERT INTO packages (title, duration_days, default_price, description, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const info = insert.run(title, duration_days, default_price, description);
    return { success: true, id: info.lastInsertRowid };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('packages:update', async (event, { id, title, duration_days, default_price, description, userRole }) => {
  try {
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can update membership packages.' };
    }

    const update = db.prepare(`
      UPDATE packages 
      SET title = ?, duration_days = ?, default_price = ?, description = ?
      WHERE id = ?
    `);
    update.run(title, duration_days, default_price, description, id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('packages:toggleActive', async (event, { id, userRole }) => {
  try {
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can modify package status.' };
    }

    const pkg = db.prepare('SELECT is_active FROM packages WHERE id = ?').get(id);
    if (!pkg) return { error: 'Package not found' };
    
    const newStatus = pkg.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE packages SET is_active = ? WHERE id = ?').run(newStatus, id);
    return { success: true, is_active: newStatus };
  } catch (err) {
    return { error: err.message };
  }
});
