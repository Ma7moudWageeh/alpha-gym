const { ipcMain, dialog, app } = require('electron');
const db = require('../db');
const path = require('path');
const fs = require('fs');

function generateNextClientCode(dbInstance = db) {
  // Retrieve the highest existing client_code or max numeric value
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

  // Generate next sequential code with safety check
  let nextNum = maxNumber + 1;
  let nextCode = `AG-${String(nextNum).padStart(4, '0')}`;

  while (dbInstance.prepare('SELECT 1 FROM clients WHERE client_code = ?').get(nextCode)) {
    nextNum++;
    nextCode = `AG-${String(nextNum).padStart(4, '0')}`;
  }

  return nextCode;
}

function mimeFromExt(ext) {
  const e = (ext || '').toLowerCase().replace('.', '');
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function resolvePhotoPath(stored) {
  if (!stored) return null;
  try {
    if (fs.existsSync(stored)) return stored;
    const userData = app.getPath('userData');
    const asAbsolute = path.isAbsolute(stored)
      ? stored
      : path.join(userData, stored);
    if (fs.existsSync(asAbsolute)) return asAbsolute;
    const byBasename = path.join(userData, 'client-photos', path.basename(stored));
    if (fs.existsSync(byBasename)) return byBasename;
  } catch (e) {
    return null;
  }
  return null;
}

function photoToDataUrl(storedPath) {
  const filePath = resolvePhotoPath(storedPath);
  if (!filePath) return null;
  try {
    const ext = path.extname(filePath);
    const base64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mimeFromExt(ext)};base64,${base64}`;
  } catch (e) {
    return null;
  }
}

/**
 * Profile-level status:
 * - frozen if any subscription is frozen
 * - active if any subscription is active with end_date >= today OR future start
 * - expired only if all subs are past end_date (and none frozen)
 * - null if no subscriptions
 */
function computeClientStatus(clientId) {
  const today = new Date().toISOString().split('T')[0];

  const frozen = db.prepare(
    "SELECT id, end_date, freeze_reason FROM subscriptions WHERE client_id = ? AND status = 'frozen' ORDER BY id DESC LIMIT 1"
  ).get(clientId);
  if (frozen) {
    return {
      sub_status: 'frozen',
      latest_end_date: frozen.end_date,
      days_since_expiry: null,
      freeze_reason: frozen.freeze_reason || null,
    };
  }

  const active = db.prepare(`
    SELECT id, end_date FROM subscriptions
    WHERE client_id = ?
      AND status = 'active'
      AND DATE(end_date) >= DATE(?)
    ORDER BY end_date DESC LIMIT 1
  `).get(clientId, today);

  if (active) {
    return {
      sub_status: 'active',
      latest_end_date: active.end_date,
      days_since_expiry: null,
      freeze_reason: null,
    };
  }

  const lastExpired = db.prepare(`
    SELECT id, end_date,
      CAST(julianday(?) - julianday(end_date) AS INT) as days_since_expiry
    FROM subscriptions
    WHERE client_id = ?
    ORDER BY end_date DESC LIMIT 1
  `).get(today, clientId);

  if (lastExpired) {
    return {
      sub_status: 'expired',
      latest_end_date: lastExpired.end_date,
      days_since_expiry: lastExpired.days_since_expiry,
      freeze_reason: null,
    };
  }

  return {
    sub_status: null,
    latest_end_date: null,
    days_since_expiry: null,
    freeze_reason: null,
  };
}

ipcMain.handle('clients:getAll', async (event, { search = '', status = 'all' } = {}) => {
  db.syncAllSubscriptionStatuses(db);
  try {
    let query = `SELECT c.* FROM clients c WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.client_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.id DESC`;

    const clients = db.prepare(query).all(...params);

    const enriched = clients.map((c) => {
      const statusInfo = computeClientStatus(c.id);
      const photoUrl = photoToDataUrl(c.profile_photo);
      return {
        ...c,
        sub_status: statusInfo.sub_status,
        latest_end_date: statusInfo.latest_end_date,
        days_since_expiry: statusInfo.days_since_expiry,
        freeze_reason: statusInfo.freeze_reason,
        profile_photo_url: photoUrl,
        photoUrl,
      };
    });

    let filteredClients = enriched;
    if (status !== 'all') {
      filteredClients = enriched.filter((c) => {
        if (status === 'active') return c.sub_status === 'active';
        if (status === 'frozen') return c.sub_status === 'frozen';
        if (status === 'expired') {
          // Only expired within last 30 days (0 < days <= 30)
          return (
            c.sub_status === 'expired' &&
            c.days_since_expiry !== null &&
            c.days_since_expiry > 0 &&
            c.days_since_expiry <= 30
          );
        }
        return true;
      });
    }

    const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM clients').get();

    // Counts for KPI cards (expired uses 30-day window)
    const activeCount = enriched.filter((c) => c.sub_status === 'active').length;
    const frozenCount = enriched.filter((c) => c.sub_status === 'frozen').length;
    const expiredCount = enriched.filter(
      (c) =>
        c.sub_status === 'expired' &&
        c.days_since_expiry !== null &&
        c.days_since_expiry > 0 &&
        c.days_since_expiry <= 30
    ).length;

    return {
      success: true,
      clients: filteredClients,
      totalCount: totalCountRow ? totalCountRow.count : filteredClients.length,
      counts: {
        all: enriched.length,
        active: activeCount,
        frozen: frozenCount,
        expired: expiredCount,
      },
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:getById', async (event, { id }) => {
  db.syncAllSubscriptionStatuses(db);
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!client) return { error: 'Client not found' };

    client.profile_photo_url = photoToDataUrl(client.profile_photo);
    client.photoUrl = client.profile_photo_url;

    const statusInfo = computeClientStatus(id);
    client.client_status = statusInfo.sub_status;
    client.latest_end_date = statusInfo.latest_end_date;
    client.days_since_expiry = statusInfo.days_since_expiry;

    // Prefer frozen, then active with valid end_date
    let activeSubscription = db.prepare(`
      SELECT s.*, p.title as package_title,
        'frozen' as computed_status
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ? AND s.status = 'frozen'
      ORDER BY s.id DESC LIMIT 1
    `).get(id);

    if (!activeSubscription) {
      activeSubscription = db.prepare(`
        SELECT s.*, p.title as package_title,
          CASE
            WHEN DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired'
            ELSE s.status
          END as computed_status
        FROM subscriptions s
        LEFT JOIN packages p ON s.package_id = p.id
        WHERE s.client_id = ?
          AND s.status = 'active'
          AND DATE(s.end_date) >= DATE('now', 'localtime')
        ORDER BY s.end_date DESC LIMIT 1
      `).get(id);
    }

    // If profile is expired, still surface the most recent sub for display context
    if (!activeSubscription && statusInfo.sub_status === 'expired') {
      activeSubscription = db.prepare(`
        SELECT s.*, p.title as package_title, 'expired' as computed_status
        FROM subscriptions s
        LEFT JOIN packages p ON s.package_id = p.id
        WHERE s.client_id = ?
        ORDER BY s.end_date DESC LIMIT 1
      `).get(id);
    }

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

ipcMain.handle('clients:create', async (event, clientData = {}) => {
  try {
    let clientCode = clientData.client_code;
    if (!clientCode || typeof clientCode !== 'string' || clientCode.trim() === '') {
      clientCode = generateNextClientCode(db);
    } else {
      clientCode = clientCode.trim();
      if (db.prepare('SELECT 1 FROM clients WHERE client_code = ?').get(clientCode)) {
        clientCode = generateNextClientCode(db);
      }
    }

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

ipcMain.handle('clients:uploadPhoto', async (event, args) => {
  try {
    const clientId = typeof args === 'object' ? (args?.client_id || args?.clientId || args?.id) : args;
    if (!clientId) return { error: 'Missing client ID' };

    let selectedPath = typeof args === 'object' ? args?.filePath : null;

    // If triggered from HTML file input and no file was selected, return canceled without opening a second dialog
    if (!selectedPath && typeof args === 'object' && args?.fromInput) {
      return { canceled: true };
    }

    if (!selectedPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Profile Photo',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths.length) return { canceled: true };
      selectedPath = filePaths[0];
    }

    const photosDir = path.join(app.getPath('userData'), 'client-photos');
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

    // Clean up existing photo if any
    const existingClient = db.prepare('SELECT profile_photo FROM clients WHERE id = ?').get(clientId);
    const oldResolved = resolvePhotoPath(existingClient?.profile_photo);
    if (oldResolved && fs.existsSync(oldResolved) && oldResolved.includes('client-photos')) {
      try { fs.unlinkSync(oldResolved); } catch (e) { /* ignore */ }
    }

    const ext = path.extname(selectedPath) || '.jpg';
    const destFilename = `client_${clientId}_${Date.now()}${ext}`;
    const destPath = path.join(photosDir, destFilename);

    fs.copyFileSync(selectedPath, destPath);

    db.prepare('UPDATE clients SET profile_photo = ? WHERE id = ?').run(destPath, clientId);

    const dataUrl = photoToDataUrl(destPath);
    return {
      success: true,
      photoPath: dataUrl,
      profile_photo_url: dataUrl,
      photoUrl: dataUrl,
    };
  } catch (err) {
    return { error: err.message };
  }
});

const handleDeletePhoto = (clientId) => {
  const id = typeof clientId === 'object' ? (clientId.client_id || clientId.clientId || clientId.id) : clientId;
  if (!id) return { error: 'Missing client ID' };

  const client = db.prepare('SELECT profile_photo FROM clients WHERE id = ?').get(id);
  const resolved = resolvePhotoPath(client?.profile_photo);
  if (resolved && fs.existsSync(resolved)) {
    try { fs.unlinkSync(resolved); } catch (e) { /* ignore */ }
  }
  db.prepare('UPDATE clients SET profile_photo = NULL WHERE id = ?').run(id);
  return { success: true };
};

ipcMain.handle('clients:deletePhoto', async (event, clientId) => {
  try {
    return handleDeletePhoto(clientId);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('clients:removePhoto', async (event, args) => {
  try {
    return handleDeletePhoto(args);
  } catch (err) {
    return { error: err.message };
  }
});
