const { ipcMain } = require('electron');
const db = require('../db');

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

ipcMain.handle('subscriptions:create', async (event, { client_id, package_id, start_date, price, paid_amount, note }) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id);
    if (!pkg) return { error: 'Package not found' };

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = addDays(startDate, pkg.duration_days);
    const subPrice = price !== undefined ? price : pkg.default_price;

    const today = new Date().toISOString().split('T')[0];
    const initialStatus = endDate < today ? 'expired' : 'active';

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (client_id, package_id, start_date, end_date, price, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const subInfo = db.transaction(() => {
      // Only expire old active subs that have already started (keep future stacked intact)
      if (startDate <= today) {
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE client_id = ? AND status = 'active'").run(client_id);
      }

      const res = insertSub.run(client_id, package_id, startDate, endDate, subPrice, initialStatus);
      const subId = res.lastInsertRowid;

      const amountPaid = paid_amount !== undefined ? paid_amount : subPrice;
      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, ?, ?, 'subscription', ?)
      `).run(client_id, subId, amountPaid, note || `Subscription: ${pkg.title}`);

      return subId;
    })();

    db.syncAllSubscriptionStatuses(db);

    return { success: true, subscription_id: subInfo, start_date: startDate, end_date: endDate, status: initialStatus };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:renew', async (event, { client_id, package_id, start_date, price, paid_amount, note }) => {
  try {
    db.syncAllSubscriptionStatuses(db);

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id);
    if (!pkg) return { error: 'Package not found' };

    const currentSub = db.prepare(
      "SELECT * FROM subscriptions WHERE client_id = ? AND status = 'active' ORDER BY end_date DESC LIMIT 1"
    ).get(client_id);

    let startDate = start_date;
    if (!startDate) {
      const today = new Date().toISOString().split('T')[0];
      if (currentSub && currentSub.end_date > today) {
        startDate = currentSub.end_date;
      } else {
        startDate = today;
      }
    }

    const endDate = addDays(startDate, pkg.duration_days);
    const subPrice = price !== undefined ? price : pkg.default_price;

    const subInfo = db.transaction(() => {
      const today = new Date().toISOString().split('T')[0];
      if (startDate <= today) {
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE client_id = ? AND status = 'active'").run(client_id);
      }

      const res = db.prepare(`
        INSERT INTO subscriptions (client_id, package_id, start_date, end_date, price, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(client_id, package_id, startDate, endDate, subPrice);

      const subId = res.lastInsertRowid;

      const amountPaid = paid_amount !== undefined ? paid_amount : subPrice;
      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, ?, ?, 'renewal', ?)
      `).run(client_id, subId, amountPaid, note || `Renewal: ${pkg.title}`);

      return subId;
    })();

    db.syncAllSubscriptionStatuses(db);

    return { success: true, subscription_id: subInfo, start_date: startDate, end_date: endDate };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:freeze', async (event, { subscription_id, reason, mode = 'indefinite', freeze_days }) => {
  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscription_id);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'active') return { error: `Cannot freeze subscription with status '${sub.status}'` };

    const today = new Date().toISOString().split('T')[0];
    const freezeMode = mode === 'timed' ? 'timed' : 'indefinite';
    const freezeReason = reason || null;

    if (freezeMode === 'timed') {
      const days = parseInt(freeze_days, 10);
      if (!days || days < 1) {
        return { error: 'Freeze days must be a positive number for timed freeze.' };
      }

      const freezeEndDate = addDays(today, days);

      // Do NOT shift end_date on freeze — only store freeze metadata
      db.prepare(`
        UPDATE subscriptions
        SET status = 'frozen',
            frozen_on = ?,
            freeze_reason = ?,
            freeze_mode = 'timed',
            freeze_end_date = ?
        WHERE id = ?
      `).run(today, freezeReason, freezeEndDate, subscription_id);

      return {
        success: true,
        frozen_on: today,
        freeze_mode: 'timed',
        freeze_end_date: freezeEndDate,
        end_date: sub.end_date,
      };
    }

    db.prepare(`
      UPDATE subscriptions
      SET status = 'frozen',
          frozen_on = ?,
          freeze_reason = ?,
          freeze_mode = 'indefinite',
          freeze_end_date = NULL
      WHERE id = ?
    `).run(today, freezeReason, subscription_id);

    return {
      success: true,
      frozen_on: today,
      freeze_mode: 'indefinite',
      end_date: sub.end_date,
    };
  } catch (err) {
    return { error: err.message };
  }
});

function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00');
  const to = new Date(toDateStr + 'T00:00:00');
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function applyUnfreeze(sub) {
  return db.unfreezeSubscriptionRecord(db, sub, new Date().toISOString().split('T')[0]);
}

ipcMain.handle('subscriptions:unfreeze', async (event, { subscription_id }) => {
  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscription_id);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'frozen') return { error: 'Subscription is not frozen' };

    const result = applyUnfreeze(sub);
    return { success: true, ...result };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:checkIn', async (event, { query }) => {
  try {
    db.syncAllSubscriptionStatuses(db);
    if (!query) return { status: 'NOT_FOUND' };

    const client = db.prepare(`
      SELECT * FROM clients
      WHERE client_code = ? OR phone = ? OR name LIKE ?
      LIMIT 1
    `).get(query, query, `%${query}%`);

    if (!client) {
      return { success: true, status: 'NOT_FOUND' };
    }

    // Prefer frozen, then any non-expired active/future sub
    const frozenSub = db.prepare(`
      SELECT s.*, p.title as package_title
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ? AND s.status = 'frozen'
      ORDER BY s.id DESC LIMIT 1
    `).get(client.id);

    if (frozenSub) {
      return {
        success: true,
        client,
        subscription: { ...frozenSub, status: 'frozen' },
        status: 'FROZEN'
      };
    }

    const activeSub = db.prepare(`
      SELECT s.*, p.title as package_title
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ?
        AND s.status = 'active'
        AND DATE(s.end_date) >= DATE('now', 'localtime')
      ORDER BY s.end_date DESC LIMIT 1
    `).get(client.id);

    if (!activeSub) {
      const lastSub = db.prepare(`
        SELECT s.*, p.title as package_title
        FROM subscriptions s
        LEFT JOIN packages p ON s.package_id = p.id
        WHERE s.client_id = ?
        ORDER BY s.id DESC LIMIT 1
      `).get(client.id);

      return {
        success: false,
        status: 'EXPIRED',
        message: 'Subscription Expired',
        client,
        subscription: lastSub || null
      };
    }

    return {
      success: true,
      client,
      subscription: { ...activeSub, status: 'active' },
      status: 'VALID'
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:getHistory', async (event, { client_id }) => {
  db.syncAllSubscriptionStatuses(db);

  try {
    const history = db.prepare(`
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
    `).all(client_id);

    return { success: true, history };
  } catch (err) {
    return { error: err.message };
  }
});
