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

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (client_id, package_id, start_date, end_date, price, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    const subInfo = db.transaction(() => {
      // Mark old active subscriptions as expired if creating a new one
      db.prepare("UPDATE subscriptions SET status = 'expired' WHERE client_id = ? AND status = 'active'").run(client_id);
      
      const res = insertSub.run(client_id, package_id, startDate, endDate, subPrice);
      const subId = res.lastInsertRowid;

      // Add payment entry
      const amountPaid = paid_amount !== undefined ? paid_amount : subPrice;
      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, ?, ?, 'subscription', ?)
      `).run(client_id, subId, amountPaid, note || `Subscription: ${pkg.title}`);

      return subId;
    })();

    return { success: true, subscription_id: subInfo, start_date: startDate, end_date: endDate };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:renew', async (event, { client_id, package_id, start_date, price, paid_amount, note }) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id);
    if (!pkg) return { error: 'Package not found' };

    // Check if client has a current active subscription
    const currentSub = db.prepare("SELECT * FROM subscriptions WHERE client_id = ? AND status = 'active' ORDER BY end_date DESC LIMIT 1").get(client_id);
    
    let startDate = start_date;
    if (!startDate) {
      const today = new Date().toISOString().split('T')[0];
    db.syncAllSubscriptionStatuses(db);
      if (currentSub && currentSub.end_date > today) {
        startDate = currentSub.end_date; // Extend from current end date
      } else {
        startDate = today;
      }
    }

    const endDate = addDays(startDate, pkg.duration_days);
    const subPrice = price !== undefined ? price : pkg.default_price;

    const subInfo = db.transaction(() => {
      // Mark old active sub as expired if new one starts today or earlier
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

    return { success: true, subscription_id: subInfo, start_date: startDate, end_date: endDate };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:freeze', async (event, { subscription_id, reason }) => {
  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscription_id);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'active') return { error: `Cannot freeze subscription with status '${sub.status}'` };

    const today = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE subscriptions SET status = 'frozen', frozen_on = CURRENT_TIMESTAMP WHERE id = ?").run(subscription_id);

    return { success: true, frozen_on: today };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:unfreeze', async (event, { subscription_id }) => {
  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscription_id);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'frozen') return { error: 'Subscription is not frozen' };

    // Calculate exactly how many days the subscription was frozen
    const row = db.prepare("SELECT CAST((JULIANDAY('now') - JULIANDAY(frozen_on)) AS INTEGER) as days_frozen FROM subscriptions WHERE id = ?").get(subscription_id);
    const diffTime = Math.max(1, row.days_frozen || 1);

    // Extend end date by frozen days
    const newEndDate = addDays(sub.end_date, diffTime);
    const totalFrozenDays = (sub.frozen_days || 0) + diffTime;

    db.prepare(`
      UPDATE subscriptions 
      SET status = 'active', end_date = ?, frozen_days = ?, frozen_on = NULL 
      WHERE id = ?
    `).run(newEndDate, totalFrozenDays, subscription_id);

    return { success: true, end_date: newEndDate, added_days: diffTime };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:checkIn', async (event, { query }) => {
  try {
    if (!query) return { status: 'NOT_FOUND' };

    const client = db.prepare(`
      SELECT * FROM clients 
      WHERE client_code = ? OR phone = ? OR name LIKE ?
      LIMIT 1
    `).get(query, query, `%${query}%`);

    if (!client) {
      return { success: true, status: 'NOT_FOUND' };
    }

    const sub = db.prepare(`
      SELECT s.*, p.title as package_title,
       CASE 
         WHEN s.status = 'frozen' THEN 'frozen' 
         WHEN DATE(s.end_date) < DATE('now', 'localtime') THEN 'expired' 
         ELSE s.status 
       END as computed_status
      FROM subscriptions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.client_id = ?
      ORDER BY s.id DESC LIMIT 1
    `).get(client.id);

    if (!sub) {
      return { success: true, client, subscription: null, status: 'EXPIRED' };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check if expired dynamically
    let currentStatus = sub.computed_status || sub.status;
    if (currentStatus === 'expired' || (sub.status === 'active' && sub.end_date < today)) {
      return { success: false, status: 'EXPIRED', message: 'Subscription Expired' };
    }

    let statusKey = 'VALID';
    if (currentStatus === 'frozen') statusKey = 'FROZEN';
    else if (currentStatus === 'expired') statusKey = 'EXPIRED';

    return {
      success: true,
      client,
      subscription: { ...sub, status: currentStatus },
      status: statusKey
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
