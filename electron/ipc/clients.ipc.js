const { ipcMain, dialog, app } = require('electron');
const db = require('../db');
const path = require('path');
const fs = require('fs');

// Helper to generate unique client code
function generateClientCode() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  const nextId = countRow.count + 1;
  return `AG-${String(nextId).padStart(4, '0')}`;
}

ipcMain.handle('clients:getAll', async (event, { search = '', status = 'all' } = {}) => {
  db.syncAllSubscriptionStatuses(db);
  try {
    let query = `
      SELECT c.*, 
        (SELECT CASE 
          WHEN s.status = 'frozen' THEN 'frozen' 
          WHEN DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired' 
          ELSE s.status 
         END FROM subscriptions s WHERE s.client_id = c.id ORDER BY s.id DESC LIMIT 1) as sub_status
      FROM clients c
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.client_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const clients = db.prepare(query).all(...params);

    // Filter by status in JS since status is derived
    let filteredClients = clients;
    if (status !== 'all') {
      filteredClients = clients.filter(c => {
        if (status === 'active') return c.sub_status === 'active';
        if (status === 'expired') return c.sub_status === 'expired';
        if (status === 'frozen') return c.sub_status === 'frozen';
        return true;
      });
    }

    // Attach base64 profile_photo_url to each client
    const clientsWithPhotos = filteredClients.map(c => {
      let profile_photo_url = null;
      if (c.profile_photo && fs.existsSync(c.profile_photo)) {
        try {
          const ext = path.extname(c.profile_photo).replace('.', '') || 'jpeg';
          const data = fs.readFileSync(c.profile_photo, 'base64');
          profile_photo_url = `data:image/${ext};base64,${data}`;
        } catch (e) {
          // ignore read errors for individual photos
        }
      }
      return { ...c, profile_photo_url };
    });

    const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM clients').get();

    return { success: true, clients: clientsWithPhotos, totalCount: totalCountRow ? totalCountRow.count : clientsWithPhotos.length };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:getById', async (event, { id }) => {
  db.syncAllSubscriptionStatuses(db);
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!client) return { error: 'Client not found' };

    let profile_photo_url = null;
    if (client.profile_photo && fs.existsSync(client.profile_photo)) {
      const ext = path.extname(client.profile_photo).replace('.', '') || 'jpeg';
      const data = fs.readFileSync(client.profile_photo, 'base64');
      profile_photo_url = `data:image/${ext};base64,${data}`;
    }
    client.profile_photo_url = profile_photo_url;

    const activeSubscription = db.prepare(`
      SELECT s.*, p.title as package_title, 
       CASE 
         WHEN s.status = 'frozen' THEN 'frozen' 
         WHEN DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired' 
         ELSE s.status 
       END as computed_status
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ? AND (s.status != 'expired' AND DATE(s.end_date) >= DATE('now', 'localtime'))
      ORDER BY s.id DESC LIMIT 1
    `).get(id);

    const subscriptionHistory = db.prepare(`
      SELECT s.*, p.title as package_title,
       CASE 
         WHEN s.status = 'frozen' THEN 'frozen' 
         WHEN DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired' 
         ELSE s.status 
       END as computed_status
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ?
      ORDER BY s.id DESC
    `).all(id);

    const bodyProgress = db.prepare('SELECT * FROM body_progress WHERE client_id = ? ORDER BY logged_at DESC').all(id);

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
    `).all(id);

    return { 
      success: true, 
      client: {
        ...client,
        activeSubscription,
        subscriptionHistory,
        bodyProgress,
        payments
      } 
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:getPayments', async (event, { client_id }) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, pkg.title as package_title
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

ipcMain.handle('clients:create', async (event, clientData) => {
  try {
    const clientCode = generateClientCode();
    
    const insert = db.prepare(`
      INSERT INTO clients (
        name, phone, date_of_birth, gender, national_id, emergency_contact, 
        notes, client_code, height_cm, weight_kg, has_conditions,
        area, other_sports, injuries, medical_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insert.run(
      clientData.name || clientData.full_name,
      clientData.phone,
      clientData.birth_date || clientData.date_of_birth || null,
      clientData.gender || null,
      clientData.national_id || null,
      clientData.emergency_contact || null,
      clientData.notes || null,
      clientCode,
      clientData.height_cm || 0,
      clientData.weight_kg || 0,
      clientData.has_conditions ? 1 : 0,
      clientData.area || null,
      clientData.other_sports || null,
      clientData.injuries || null,
      clientData.medical_details || null
    );

    return { success: true, id: info.lastInsertRowid, client_code: clientCode };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:update', async (event, clientData) => {
  try {
    const { id, ...data } = clientData;
    
    const fields = [];
    const values = [];
    
    const updatableFields = [
      'name', 'phone', 'date_of_birth', 'gender', 'national_id', 
      'emergency_contact', 'notes', 'height_cm', 'weight_kg', 'has_conditions',
      'area', 'other_sports', 'injuries', 'medical_details', 'profile_photo'
    ];
    
    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return { success: true };

    values.push(id);
    
    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:delete', async (event, { id, userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can delete clients.' };
    }
    
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Upload profile photo ──────────────────────────────────────────────────────
ipcMain.handle('clients:uploadPhoto', async (event, { client_id }) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Profile Photo',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths.length) return { canceled: true };

    // Ensure photos directory exists inside userData
    const photosDir = path.join(app.getPath('userData'), 'client-photos');
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

    const ext = path.extname(filePaths[0]);
    const destFilename = `client_${client_id}_${Date.now()}${ext}`;
    const destPath = path.join(photosDir, destFilename);

    fs.copyFileSync(filePaths[0], destPath);

    // Store absolute path in DB
    db.prepare('UPDATE clients SET profile_photo = ? WHERE id = ?').run(destPath, client_id);

    // Return base64 URL so the renderer can display it
    const data = fs.readFileSync(destPath, 'base64');
    const ext2 = ext.replace('.', '') || 'jpeg';
    return { success: true, photoPath: `data:image/${ext2};base64,${data}` };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Remove profile photo ──────────────────────────────────────────────────────
ipcMain.handle('clients:removePhoto', async (event, { client_id }) => {
  try {
    const client = db.prepare('SELECT profile_photo FROM clients WHERE id = ?').get(client_id);
    if (client?.profile_photo && fs.existsSync(client.profile_photo)) {
      fs.unlinkSync(client.profile_photo);
    }
    db.prepare('UPDATE clients SET profile_photo = NULL WHERE id = ?').run(client_id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
