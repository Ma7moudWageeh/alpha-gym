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
 * - active if any subscription is active with end_date >= today
 * - expired strictly if past end_date AND within last 30 days (days_since_expiry <= 30)
 * - inactive if past end_date AND > 30 days
 * - null/no_plan if no subscriptions
 */
function computeClientStatus(clientId) {
  const today = new Date().toISOString().split('T')[0];

  const frozen = db.prepare(
    "SELECT id, end_date, freeze_reason FROM subscriptions WHERE client_id = ? AND status = 'frozen' ORDER BY id DESC LIMIT 1"
  ).get(clientId);
  if (frozen) {
    return {
      sub_status: 'frozen',
      computed_status: 'FROZEN',
      latest_end_date: frozen.end_date,
      days_left: null,
      days_since_expiry: null,
      freeze_reason: frozen.freeze_reason || null,
    };
  }

  const active = db.prepare(`
    SELECT id, end_date,
      CAST(julianday(DATE(end_date)) - julianday(DATE(?)) AS INT) as days_left
    FROM subscriptions
    WHERE client_id = ?
      AND (status = 'active' OR DATE(end_date) >= DATE(?))
      AND DATE(end_date) >= DATE(?)
    ORDER BY end_date DESC LIMIT 1
  `).get(today, clientId, today, today);

  if (active) {
    return {
      sub_status: 'active',
      computed_status: 'ACTIVE',
      latest_end_date: active.end_date,
      days_left: active.days_left,
      days_since_expiry: null,
      freeze_reason: null,
    };
  }

  const lastExpired = db.prepare(`
    SELECT id, end_date,
      CAST(julianday(DATE(?)) - julianday(DATE(end_date)) AS INT) as days_since_expiry,
      CAST(julianday(DATE(end_date)) - julianday(DATE(?)) AS INT) as days_left
    FROM subscriptions
    WHERE client_id = ?
    ORDER BY end_date DESC LIMIT 1
  `).get(today, today, clientId);

  if (lastExpired) {
    const daysSince = lastExpired.days_since_expiry !== null ? lastExpired.days_since_expiry : 0;
    const isWithin30 = daysSince >= 0 && daysSince <= 30;
    return {
      sub_status: isWithin30 ? 'expired' : 'inactive',
      computed_status: isWithin30 ? 'EXPIRED' : 'INACTIVE',
      latest_end_date: lastExpired.end_date,
      days_left: lastExpired.days_left,
      days_since_expiry: daysSince,
      freeze_reason: null,
    };
  }

  return {
    sub_status: null,
    computed_status: 'NO_PLAN',
    latest_end_date: null,
    days_left: null,
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
      const createdAt = c.registered_at || c.created_at || null;
      return {
        ...c,
        created_at: createdAt,
        registered_at: createdAt,
        sub_status: statusInfo.sub_status,
        computed_status: statusInfo.computed_status,
        latest_end_date: statusInfo.latest_end_date,
        days_left: statusInfo.days_left,
        days_since_expiry: statusInfo.days_since_expiry,
        freeze_reason: statusInfo.freeze_reason,
        profile_photo_url: photoUrl,
        photoUrl,
      };
    });

    let filteredClients = enriched;
    if (status !== 'all') {
      filteredClients = enriched.filter((c) => {
        if (status === 'active') return c.sub_status === 'active' || c.computed_status === 'ACTIVE';
        if (status === 'frozen') return c.sub_status === 'frozen' || c.computed_status === 'FROZEN';
        if (status === 'expired') return c.sub_status === 'expired' || c.computed_status === 'EXPIRED';
        if (status === 'inactive') return c.sub_status === 'inactive' || c.computed_status === 'INACTIVE';
        return true;
      });
    }

    const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM clients').get();

    // Counts for KPI cards — expired strictly within 30 days
    const activeCount = enriched.filter((c) => c.sub_status === 'active' || c.computed_status === 'ACTIVE').length;
    const frozenCount = enriched.filter((c) => c.sub_status === 'frozen' || c.computed_status === 'FROZEN').length;
    const expiredCount = enriched.filter((c) => c.sub_status === 'expired' || c.computed_status === 'EXPIRED').length;

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

ipcMain.handle('clients:getStats', async () => {
  db.syncAllSubscriptionStatuses(db);
  try {
    const clients = db.prepare('SELECT id FROM clients').all();
    let active = 0;
    let frozen = 0;
    let expired = 0;

    for (const c of clients) {
      const statusInfo = computeClientStatus(c.id);
      if (statusInfo.computed_status === 'ACTIVE') active++;
      else if (statusInfo.computed_status === 'FROZEN') frozen++;
      else if (statusInfo.computed_status === 'EXPIRED') expired++;
    }

    return {
      success: true,
      total: clients.length,
      active,
      frozen,
      expired,
      counts: {
        all: clients.length,
        active,
        frozen,
        expired,
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
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
    client.sub_status = statusInfo.sub_status;
    client.computed_status = statusInfo.computed_status;
    client.latest_end_date = statusInfo.latest_end_date;
    client.days_since_expiry = statusInfo.days_since_expiry;
    client.days_left = statusInfo.days_left;
    client.created_at = client.registered_at || client.created_at || null;
    client.registered_at = client.created_at;

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

// Birthday query — returns all clients whose date_of_birth month+day matches today.
// Uses Node-side filtering via isBirthdayToday logic to avoid timezone mismatches.
ipcMain.handle('clients:getTodayBirthdays', async () => {
  try {
    const rows = db.prepare(`
      SELECT id, client_code, name, phone, date_of_birth, profile_photo
      FROM clients
      WHERE date_of_birth IS NOT NULL AND date_of_birth != ''
      ORDER BY name ASC
    `).all();

    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay   = now.getDate();

    const birthdays = rows.filter((row) => {
      try {
        let normalized = String(row.date_of_birth).trim();
        // Handle DD/MM/YYYY format
        const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          normalized = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
        }
        const parsed = new Date(normalized);
        if (isNaN(parsed.getTime())) return false;
        return (parsed.getMonth() + 1) === todayMonth && parsed.getDate() === todayDay;
      } catch {
        return false;
      }
    }).map((row) => ({
      ...row,
      client_id:   row.id,
      client_name: row.name,
      client_phone: row.phone,
    }));

    return { success: true, birthdays };
  } catch (err) {
    return { success: false, error: err.message, birthdays: [] };
  }
});

