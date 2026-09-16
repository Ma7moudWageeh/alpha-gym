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
    WHERE client_id = ? AND end_date IS NOT NULL
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

ipcMain.handle('clients:getAll', async (event, args = {}) => {
  const { search = '', status = 'all' } = (args && typeof args === 'object') ? args : {};
  try {
    db.syncAllSubscriptionStatuses(db);
  } catch (syncErr) {
    console.error('[clients:getAll] Status sync warning:', syncErr.message);
  }

  try {
    const params = [];
    let searchClause = '';
    if (search && search.trim()) {
      searchClause = ` WHERE (c.name LIKE ? OR c.phone LIKE ? OR c.client_code LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    let clients = [];
    try {
      const query = `
        SELECT 
          c.*,
          s.id AS current_subscription_id,
          s.end_date AS subscription_end,
          COALESCE(s.status, 'active') AS subscription_status,
          COALESCE(s.is_frozen, 0) AS subscription_is_frozen
        FROM clients c 
        LEFT JOIN subscriptions s ON s.id = (
          SELECT id FROM subscriptions 
          WHERE client_id = c.id 
          ORDER BY id DESC 
          LIMIT 1
        )
        ${searchClause}
        ORDER BY c.id DESC
      `;
      clients = db.prepare(query).all(...params);
    } catch (primaryErr) {
      console.error('[clients:getAll] Primary query failed, falling back to basic query:', primaryErr.message);
      const fallbackQuery = search && search.trim()
        ? `SELECT * FROM clients WHERE (name LIKE ? OR phone LIKE ? OR client_code LIKE ?) ORDER BY id DESC`
        : `SELECT * FROM clients ORDER BY id DESC`;
      clients = db.prepare(fallbackQuery).all(...params);
    }

    if (!Array.isArray(clients)) clients = [];

    const enriched = clients.map((c) => {
      let statusInfo = {
        sub_status: c.status || 'active',
        computed_status: String(c.status || 'active').toUpperCase(),
        latest_end_date: c.end_date || c.subscription_end || null,
        days_left: null,
        days_since_expiry: null,
        freeze_reason: null,
      };

      try {
        statusInfo = computeClientStatus(c.id);
      } catch (e) {}

      const isFrozen = Boolean(
        statusInfo.sub_status === 'frozen' ||
        statusInfo.computed_status === 'FROZEN' ||
        String(c.status || '').toLowerCase() === 'frozen' ||
        String(c.subscription_status || '').toLowerCase() === 'frozen' ||
        c.is_frozen === 1 ||
        c.is_frozen === true ||
        c.subscription_is_frozen === 1 ||
        c.subscription_is_frozen === true
      );

      const effectiveSubStatus = isFrozen ? 'frozen' : (statusInfo.sub_status || c.status || 'active');
      const effectiveComputedStatus = isFrozen ? 'FROZEN' : statusInfo.computed_status;

      let photoUrl = null;
      try {
        photoUrl = photoToDataUrl(c.profile_photo);
      } catch (e) {}

      const createdAt = c.registered_at || c.created_at || null;
      return {
        ...c,
        remaining_debt: Number(c.remaining_debt || 0),
        created_at: createdAt,
        registered_at: createdAt,
        status: effectiveSubStatus,
        is_frozen: isFrozen ? 1 : 0,
        subscription_status: c.subscription_status || effectiveSubStatus,
        subscription_is_frozen: isFrozen ? 1 : 0,
        sub_status: effectiveSubStatus,
        computed_status: effectiveComputedStatus,
        latest_end_date: statusInfo.latest_end_date || c.end_date,
        end_date: statusInfo.latest_end_date || c.end_date || c.subscription_end,
        days_left: isFrozen ? null : statusInfo.days_left,
        days_since_expiry: isFrozen ? null : statusInfo.days_since_expiry,
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

    let totalCount = enriched.length;
    try {
      const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM clients').get();
      if (totalCountRow && totalCountRow.count !== undefined) {
        totalCount = totalCountRow.count;
      }
    } catch (e) {}

    // Counts for KPI cards — expired strictly within 30 days
    const activeCount = enriched.filter((c) => c.sub_status === 'active' || c.computed_status === 'ACTIVE').length;
    const frozenCount = enriched.filter((c) => c.sub_status === 'frozen' || c.computed_status === 'FROZEN').length;
    const expiredCount = enriched.filter((c) => c.sub_status === 'expired' || c.computed_status === 'EXPIRED').length;

    return {
      success: true,
      clients: filteredClients,
      totalCount: totalCount,
      counts: {
        all: enriched.length,
        active: activeCount,
        frozen: frozenCount,
        expired: expiredCount,
      }
    };
  } catch (err) {
    console.error('[clients:getAll] Fatal error, returning safe emergency fallback:', err.message);
    try {
      const rawClients = db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
      return {
        success: true,
        clients: Array.isArray(rawClients) ? rawClients : [],
        totalCount: Array.isArray(rawClients) ? rawClients.length : 0,
        counts: {
          all: Array.isArray(rawClients) ? rawClients.length : 0,
          active: Array.isArray(rawClients) ? rawClients.length : 0,
          frozen: 0,
          expired: 0,
        }
      };
    } catch (fatalErr) {
      console.error('[clients:getAll] Absolute fatal failure:', fatalErr.message);
      return {
        success: true,
        clients: [],
        totalCount: 0,
        counts: { all: 0, active: 0, frozen: 0, expired: 0 }
      };
    }
  }
});

ipcMain.handle('clients:getStats', async () => {
  try {
    db.syncAllSubscriptionStatuses(db);
  } catch (syncErr) {
    console.error('[clients:getStats] Status sync warning:', syncErr.message);
  }
  try {
    let clients = [];
    try {
      clients = db.prepare('SELECT id, status, is_frozen FROM clients').all();
    } catch (e1) {
      try {
        clients = db.prepare('SELECT id, status FROM clients').all();
      } catch (e2) {
        clients = db.prepare('SELECT id FROM clients').all();
      }
    }
    let active = 0;
    let frozen = 0;
    let expired = 0;

    for (const c of clients) {
      let statusInfo = { sub_status: c.status || 'active', computed_status: 'ACTIVE' };
      try {
        statusInfo = computeClientStatus(c.id);
      } catch (e) {}
      const isFrozen = Boolean(
        statusInfo.sub_status === 'frozen' ||
        statusInfo.computed_status === 'FROZEN' ||
        String(c.status || '').toLowerCase() === 'frozen' ||
        c.is_frozen === 1
      );
      if (isFrozen) {
        frozen++;
      } else if (statusInfo.computed_status === 'ACTIVE') {
        active++;
      } else if (statusInfo.computed_status === 'EXPIRED') {
        expired++;
      }
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
    console.error('[clients:getStats] Error calculating stats:', err.message);
    return {
      success: true,
      total: 0,
      active: 0,
      frozen: 0,
      expired: 0,
      counts: { all: 0, active: 0, frozen: 0, expired: 0 }
    };
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

    const isFrozen = Boolean(
      statusInfo.sub_status === 'frozen' ||
      statusInfo.computed_status === 'FROZEN' ||
      String(client.status || '').toLowerCase() === 'frozen' ||
      client.is_frozen === 1 ||
      (activeSubscription && activeSubscription.status === 'frozen')
    );

    client.is_frozen = isFrozen ? 1 : 0;
    if (isFrozen) {
      client.status = 'frozen';
      client.sub_status = 'frozen';
      client.client_status = 'frozen';
      client.computed_status = 'FROZEN';
    }

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
         WHEN s.end_date IS NOT NULL AND DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired'
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

ipcMain.handle('clients:create', async (event, data = {}) => {
  try {
    const insertTransaction = db.transaction(() => {
      // 1. Resolve client code defensively
      let clientCode = data.client_code;
      if (!clientCode || typeof clientCode !== 'string' || clientCode.trim() === '') {
        clientCode = generateNextClientCode(db);
      } else {
        clientCode = clientCode.trim();
        if (db.prepare('SELECT 1 FROM clients WHERE client_code = ?').get(clientCode)) {
          clientCode = generateNextClientCode(db);
        }
      }

      const planId = data.plan_id ?? data.planId ?? data.package_id ?? data.packageId;

      if (planId) {
        // 1. Fetch chosen plan details
        const plan = db.prepare('SELECT * FROM packages WHERE id = ?').get(planId)
          || db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
        if (!plan) throw new Error('Selected membership plan does not exist');

        // 2. Resolve financial numbers defensively
        const planPrice = Number(data.price ?? data.planPrice ?? plan.price ?? plan.default_price ?? 0);
        const paidAmount = Number(data.paid_amount ?? data.paidAmount ?? planPrice);
        const remainingAmount = Math.max(0, Number((planPrice - paidAmount).toFixed(2)));

        // 3. Compute Dates
        const today = new Date();
        const startDate = data.start_date || today.toISOString().split('T')[0];
        const durationDays = plan.duration_days || 30;
        let endDate;
        if (data.end_date) {
          endDate = data.end_date;
        } else {
          const endDateObj = new Date(startDate);
          endDateObj.setDate(endDateObj.getDate() + (durationDays - 1));
          endDate = endDateObj.toISOString().split('T')[0];
        }

        // Normalize status defensively to lowercase matching SQLite constraint
        const rawStatus = data.status || 'active';
        const safeStatus = ['active', 'frozen', 'expired'].includes(String(rawStatus).toLowerCase())
          ? String(rawStatus).toLowerCase()
          : 'active';

        // 4. Insert client with remaining_debt initialized
        const clientInsert = db.prepare(`
          INSERT INTO clients (
            name, phone, national_id, gender, date_of_birth, birth_date,
            status, start_date, end_date, remaining_debt, created_at,
            client_code, height_cm, weight_kg, has_conditions,
            area, other_sports, injuries, medical_details, emergency_contact, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.name || data.full_name,
          data.phone,
          data.national_id || null,
          data.gender || 'MALE',
          data.birth_date || data.date_of_birth || null,
          data.birth_date || data.date_of_birth || null,
          safeStatus,
          startDate,
          endDate,
          remainingAmount,
          clientCode,
          data.height_cm || 0,
          data.weight_kg || 0,
          data.has_conditions ? 1 : 0,
          data.area || null,
          data.other_sports || null,
          data.injuries || null,
          data.medical_details || null,
          data.emergency_contact || null,
          data.notes || null
        );

        const clientId = clientInsert.lastInsertRowid;

        // 5. Insert subscription record with financial breakdown
        const subInsert = db.prepare(`
          INSERT INTO subscriptions (
            client_id, package_id, plan_id, start_date, end_date, duration_days,
            price, paid_amount, remaining_amount, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
        `).run(
          clientId,
          plan.id,
          plan.id,
          startDate,
          endDate,
          durationDays,
          planPrice,
          paidAmount,
          remainingAmount
        );

        const subscriptionId = subInsert.lastInsertRowid;

        // 6. Record payment and cash collected into transactions
        if (paidAmount > 0) {
          db.prepare(`
            INSERT INTO payments (client_id, subscription_id, amount, type, note)
            VALUES (?, ?, ?, 'subscription', ?)
          `).run(clientId, subscriptionId, paidAmount, `New Member Subscription - Paid: ${paidAmount} EGP, Due: ${remainingAmount} EGP`);

          try {
            db.prepare(`
              INSERT INTO transactions (
                client_id, type, amount, category, date, notes
              ) VALUES (?, 'INCOME', ?, 'MEMBERSHIP', date('now', 'localtime'), ?)
            `).run(clientId, paidAmount, `New Member Subscription - Paid: ${paidAmount} EGP, Due: ${remainingAmount} EGP`);
          } catch (e) {}
        }

        // Return complete client entity
        const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
        return {
          success: true,
          id: clientId,
          client_code: clientCode,
          client: {
            ...newClient,
            planName: plan.title || plan.name,
            planPrice,
            paidAmount,
            remainingAmount
          }
        };
      } else {
        const rawStatus = data.status || 'active';
        const safeStatus = ['active', 'frozen', 'expired'].includes(String(rawStatus).toLowerCase())
          ? String(rawStatus).toLowerCase()
          : 'active';

        const clientInsert = db.prepare(`
          INSERT INTO clients (
            name, phone, national_id, gender, date_of_birth, birth_date,
            client_code, height_cm, weight_kg, has_conditions,
            area, other_sports, injuries, medical_details, emergency_contact, notes,
            remaining_debt, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          data.name || data.full_name,
          data.phone,
          data.national_id || null,
          data.gender || null,
          data.birth_date || data.date_of_birth || null,
          data.birth_date || data.date_of_birth || null,
          clientCode,
          data.height_cm || 0,
          data.weight_kg || 0,
          data.has_conditions ? 1 : 0,
          data.area || null,
          data.other_sports || null,
          data.injuries || null,
          data.medical_details || null,
          data.emergency_contact || null,
          data.notes || null,
          Number(data.remaining_debt ?? data.remainingAmount ?? data.remaining_amount ?? 0),
          safeStatus
        );

        const clientId = clientInsert.lastInsertRowid;
        const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
        return {
          success: true,
          id: clientId,
          client_code: clientCode,
          client: newClient
        };
      }
    });

    return insertTransaction();
  } catch (err) {
    return { success: false, error: err.message };
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

ipcMain.handle('clients:delete', async (event, args = {}) => {
  try {
    const { clientId, id, purgeFinancials, userRole } = (args && typeof args === 'object') ? args : {};
    const targetId = clientId || id;
    if (!targetId) return { success: false, error: 'Client ID is required' };

    if (userRole && userRole !== 'owner') {
      return { success: false, error: 'Unauthorized: Only owners can delete clients.' };
    }

    const runDelete = db.transaction(() => {
      if (purgeFinancials) {
        // 1. Delete all transactions linked to this client (reverting revenues)
        try {
          db.prepare(`DELETE FROM transactions WHERE client_id = ?`).run(targetId);
        } catch (e) {}
        // 2. Delete all payments linked to this client
        try {
          db.prepare(`DELETE FROM payments WHERE client_id = ?`).run(targetId);
        } catch (e) {}
      } else {
        // Retain accounting records by anonymizing client_id
        try {
          db.prepare(`UPDATE transactions SET client_id = NULL WHERE client_id = ?`).run(targetId);
        } catch (e) {}
        try {
          db.prepare(`UPDATE payments SET client_id = NULL WHERE client_id = ?`).run(targetId);
        } catch (e) {}
      }

      // Delete attendance / check-in logs
      try {
        db.prepare(`DELETE FROM checkins WHERE client_id = ?`).run(targetId);
      } catch (e) {}
      try {
        db.prepare(`DELETE FROM attendance WHERE client_id = ?`).run(targetId);
      } catch (e) {}
      try {
        db.prepare(`DELETE FROM body_progress WHERE client_id = ?`).run(targetId);
      } catch (e) {}
      try {
        db.prepare(`DELETE FROM alerts WHERE client_id = ?`).run(targetId);
      } catch (e) {}

      // Delete client subscriptions
      try {
        db.prepare(`DELETE FROM subscriptions WHERE client_id = ?`).run(targetId);
      } catch (e) {}

      // Clean up client photo if present
      try {
        const existingClient = db.prepare('SELECT profile_photo FROM clients WHERE id = ?').get(targetId);
        const oldResolved = resolvePhotoPath(existingClient?.profile_photo);
        if (oldResolved && fs.existsSync(oldResolved) && oldResolved.includes('client-photos')) {
          fs.unlinkSync(oldResolved);
        }
      } catch (e) {}

      // Delete master client record
      db.prepare(`DELETE FROM clients WHERE id = ?`).run(targetId);

      return true;
    });

    runDelete();
    return { success: true };
  } catch (err) {
    console.error('[clients:delete] Error deleting client:', err.message);
    return { success: false, error: err.message };
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

ipcMain.handle('clients:settleDebt', async (event, { clientId, amount, notes }) => {
  try {
    const cleanAmount = Number(parseFloat(amount || 0).toFixed(2));
    if (!clientId || isNaN(cleanAmount) || cleanAmount <= 0) {
      return { success: false, error: 'Settlement amount must be greater than zero' };
    }

    const clientRow = db.prepare('SELECT id, remaining_debt FROM clients WHERE id = ?').get(clientId);
    if (!clientRow) {
      return { success: false, error: 'Client not found' };
    }

    const currentDebt = Number(clientRow.remaining_debt || 0);
    if (cleanAmount > currentDebt) {
      return { success: false, error: 'Settlement amount cannot exceed remaining balance' };
    }

    const runSettlement = db.transaction((cId, numAmount, noteText) => {
      // 1. Fetch unpaid subscriptions for this client chronologically
      const unpaidSubs = db.prepare(`
        SELECT id, remaining_amount, paid_amount 
        FROM subscriptions 
        WHERE client_id = ? AND remaining_amount > 0 
        ORDER BY created_at ASC
      `).all(cId);

      let amountLeftToApply = numAmount;

      for (const sub of unpaidSubs) {
        if (amountLeftToApply <= 0) break;
        const currentSubRemaining = Number(sub.remaining_amount || 0);
        const deduction = Math.min(currentSubRemaining, amountLeftToApply);

        // Strict Date Invariance: Only remaining_amount and paid_amount are updated
        db.prepare(`
          UPDATE subscriptions 
          SET remaining_amount = MAX(0, remaining_amount - ?),
              paid_amount = paid_amount + ?
          WHERE id = ?
        `).run(deduction, deduction, sub.id);

        amountLeftToApply = Number((amountLeftToApply - deduction).toFixed(2));
      }

      // 2. Recalculate and update client cached remaining debt
      db.prepare(`
        UPDATE clients 
        SET remaining_debt = (
          SELECT COALESCE(SUM(remaining_amount), 0) 
          FROM subscriptions 
          WHERE client_id = ?
        )
        WHERE id = ?
      `).run(cId, cId);

      // 3. Record income entry in transactions ledger and payments
      db.prepare(`
        INSERT INTO transactions (client_id, type, amount, category, date, notes)
        VALUES (?, 'INCOME', ?, 'DEBT_SETTLEMENT', date('now'), ?)
      `).run(cId, numAmount, noteText || 'Subscription remaining balance settlement');

      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, NULL, ?, 'debt_settlement', ?)
      `).run(cId, numAmount, noteText || 'Subscription remaining balance settlement');

      return true;
    });

    runSettlement(clientId, cleanAmount, notes);
    const updatedClient = db.prepare('SELECT remaining_debt FROM clients WHERE id = ?').get(clientId);
    return { success: true, remaining_debt: Number(updatedClient?.remaining_debt || 0) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

