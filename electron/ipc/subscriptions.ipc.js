const { ipcMain } = require('electron');
const db = require('../db');

function getLocalDateStr(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

ipcMain.handle('subscriptions:create', async (event, args = {}) => {
  try {
    const {
      client_id,
      package_id,
      plan_id,
      start_date,
      price,
      planPrice,
      paid_amount,
      paidAmount,
      note,
    } = args;

    const chosenPkgId = package_id || plan_id;
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(chosenPkgId)
      || db.prepare('SELECT * FROM plans WHERE id = ?').get(chosenPkgId);
    if (!pkg) return { error: 'Package not found' };

    const durationDays = pkg.duration_days || 30;
    const rawPrice = price ?? planPrice ?? pkg.default_price ?? pkg.price ?? 0;
    const cleanPrice = Number(parseFloat(rawPrice !== '' && rawPrice !== undefined ? rawPrice : 0).toFixed(2));
    const subPrice = Math.max(0, cleanPrice);

    const rawPaid = (paid_amount !== undefined && paid_amount !== '')
      ? paid_amount
      : ((paidAmount !== undefined && paidAmount !== '') ? paidAmount : subPrice);
    const cleanPaid = Number(parseFloat(rawPaid).toFixed(2));
    const amountPaid = Math.max(0, cleanPaid);
    const remainingAmount = Math.max(0, Number((subPrice - amountPaid).toFixed(2)));
    const today = getLocalDateStr();

    const startDate = start_date || today;
    const endDate = addDays(startDate, durationDays - 1);
    const initialStatus = endDate < today ? 'expired' : 'active';

    const subInfo = db.transaction(() => {
      // Only expire old active subs that have already started (keep future stacked intact)
      if (startDate <= today) {
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE client_id = ? AND status = 'active'").run(client_id);
      }

      const res = db.prepare(`
        INSERT INTO subscriptions (client_id, package_id, plan_id, start_date, end_date, duration_days, price, paid_amount, remaining_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(client_id, chosenPkgId, chosenPkgId, startDate, endDate, durationDays, subPrice, amountPaid, remainingAmount, initialStatus);

      const subId = res.lastInsertRowid;

      db.prepare(`
        UPDATE clients 
        SET start_date = ?, end_date = ?, status = 'active',
            remaining_debt = (
              SELECT COALESCE(SUM(remaining_amount), 0) 
              FROM subscriptions 
              WHERE client_id = ?
            )
        WHERE id = ?
      `).run(startDate, endDate, client_id, client_id);

      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, ?, ?, 'subscription', ?)
      `).run(client_id, subId, amountPaid, note || `Subscription: ${pkg.title}`);

      try {
        db.prepare(`
          INSERT INTO transactions (client_id, subscription_id, type, amount, category, date, notes)
          VALUES (?, ?, 'INCOME', ?, 'MEMBERSHIP', date('now', 'localtime'), ?)
        `).run(client_id, subId, amountPaid, note || `Subscription: ${pkg.title}`);
      } catch (e) {
        try {
          db.prepare(`
            INSERT INTO transactions (client_id, type, amount, category, date, notes)
            VALUES (?, 'INCOME', ?, 'MEMBERSHIP', date('now', 'localtime'), ?)
          `).run(client_id, amountPaid, note || `Subscription: ${pkg.title}`);
        } catch (e2) {}
      }

      return subId;
    })();

    db.syncAllSubscriptionStatuses(db);

    return {
      success: true,
      subscription_id: subInfo,
      start_date: startDate,
      end_date: endDate,
      duration_days: durationDays,
      price: subPrice,
      paid_amount: amountPaid,
      remaining_amount: remainingAmount,
      status: initialStatus
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:renew', async (event, { client_id, package_id, start_date, price, paid_amount, note, stack_after_current, stackAfterCurrent }) => {
  try {
    db.syncAllSubscriptionStatuses(db);

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id);
    if (!pkg) return { error: 'Package not found' };

    const durationDays = pkg.duration_days || 30;
    const cleanPrice = Number(parseFloat(price !== undefined && price !== '' ? price : (pkg.default_price || 0)).toFixed(2));
    const subPrice = Math.max(0, cleanPrice);
    const cleanPaid = Number(parseFloat(paid_amount !== undefined && paid_amount !== '' ? paid_amount : subPrice).toFixed(2));
    const amountPaid = Math.max(0, cleanPaid);
    const remainingAmount = Math.max(0, Number((subPrice - amountPaid).toFixed(2)));
    const today = getLocalDateStr();

    // Query client's latest non-deferred subscription
    const latestSub = db.prepare(`
      SELECT id, start_date, end_date, status 
      FROM subscriptions 
      WHERE client_id = ? AND end_date IS NOT NULL
      ORDER BY end_date DESC 
      LIMIT 1
    `).get(client_id);

    const hasActivePlan = Boolean(latestSub && latestSub.end_date && latestSub.end_date >= today);
    const shouldStack = (stack_after_current !== undefined ? Boolean(stack_after_current) : (stackAfterCurrent !== undefined ? Boolean(stackAfterCurrent) : true));

    let startDateStr;
    let endDateStr;

    if (hasActivePlan && shouldStack && !start_date) {
      // Consecutive Stacking: new_start = current_end + 1 day
      startDateStr = addDays(latestSub.end_date, 1);
      endDateStr = addDays(startDateStr, durationDays - 1);
    } else {
      const baseDateStr = start_date || today;
      startDateStr = baseDateStr;
      endDateStr = addDays(baseDateStr, durationDays - 1);
    }

    const subInfo = db.transaction(() => {
      // Only expire older active subs if new sub starts today or earlier
      if (startDateStr <= today) {
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE client_id = ? AND status = 'active'").run(client_id);
      }

      const res = db.prepare(`
        INSERT INTO subscriptions (client_id, package_id, start_date, end_date, duration_days, price, paid_amount, remaining_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(client_id, package_id, startDateStr, endDateStr, durationDays, subPrice, amountPaid, remainingAmount);

      const subId = res.lastInsertRowid;

      // Update client record with the latest pushed-out end_date and active status
      db.prepare(`
        UPDATE clients 
        SET end_date = CASE 
                         WHEN end_date IS NULL OR end_date < ? THEN ? 
                         ELSE end_date 
                       END,
            status = 'active',
            remaining_debt = (
              SELECT COALESCE(SUM(remaining_amount), 0) 
              FROM subscriptions 
              WHERE client_id = ?
            )
        WHERE id = ?
      `).run(endDateStr, endDateStr, client_id, client_id);

      db.prepare(`
        INSERT INTO payments (client_id, subscription_id, amount, type, note)
        VALUES (?, ?, ?, 'renewal', ?)
      `).run(client_id, subId, amountPaid, note || `Renewal: ${pkg.title}`);

      try {
        db.prepare(`
          INSERT INTO transactions (client_id, subscription_id, type, amount, category, date, notes)
          VALUES (?, ?, 'INCOME', ?, 'MEMBERSHIP', date('now', 'localtime'), ?)
        `).run(client_id, subId, amountPaid, note || `Renewal: ${pkg.title}`);
      } catch (e) {
        try {
          db.prepare(`
            INSERT INTO transactions (client_id, type, amount, category, date, notes)
            VALUES (?, 'INCOME', ?, 'MEMBERSHIP', date('now', 'localtime'), ?)
          `).run(client_id, amountPaid, note || `Renewal: ${pkg.title}`);
        } catch (e2) {}
      }

      return subId;
    })();

    db.syncAllSubscriptionStatuses(db);

    return {
      success: true,
      subscription_id: subInfo,
      start_date: startDateStr,
      end_date: endDateStr,
      duration_days: durationDays,
      price: subPrice,
      paid_amount: amountPaid,
      remaining_amount: remainingAmount
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('subscriptions:freeze', async (event, { subscription_id, subscriptionId, clientId, reason, mode = 'indefinite', freeze_days }) => {
  try {
    const subId = subscription_id || subscriptionId;
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'active') return { error: `Cannot freeze subscription with status '${sub.status}'` };

    const targetClientId = clientId || sub.client_id;
    const today = new Date().toISOString().split('T')[0];
    const freezeMode = mode === 'timed' ? 'timed' : 'indefinite';
    const freezeReason = reason || null;

    const runFreeze = db.transaction(() => {
      if (freezeMode === 'timed') {
        const days = parseInt(freeze_days, 10);
        if (!days || days < 1) {
          throw new Error('Freeze days must be a positive number for timed freeze.');
        }

        const freezeEndDate = addDays(today, days);

        db.prepare(`
          UPDATE subscriptions
          SET status = 'frozen',
              is_frozen = 1,
              freeze_date = ?,
              frozen_on = ?,
              freeze_reason = ?,
              freeze_mode = 'timed',
              freeze_end_date = ?
          WHERE id = ?
        `).run(today, today, freezeReason, freezeEndDate, subId);

        db.prepare(`
          UPDATE clients
          SET status = 'frozen',
              is_frozen = 1
          WHERE id = ?
        `).run(targetClientId);

        return {
          frozen_on: today,
          freeze_mode: 'timed',
          freeze_end_date: freezeEndDate,
          end_date: sub.end_date,
        };
      } else {
        db.prepare(`
          UPDATE subscriptions
          SET status = 'frozen',
              is_frozen = 1,
              freeze_date = ?,
              frozen_on = ?,
              freeze_reason = ?,
              freeze_mode = 'indefinite',
              freeze_end_date = NULL
          WHERE id = ?
        `).run(today, today, freezeReason, subId);

        db.prepare(`
          UPDATE clients
          SET status = 'frozen',
              is_frozen = 1
          WHERE id = ?
        `).run(targetClientId);

        return {
          frozen_on: today,
          freeze_mode: 'indefinite',
          end_date: sub.end_date,
        };
      }
    });

    const result = runFreeze();
    db.syncAllSubscriptionStatuses(db);
    return { success: true, ...result };
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

ipcMain.handle('subscriptions:unfreeze', async (event, { subscription_id, subscriptionId, clientId }) => {
  try {
    const subId = subscription_id || subscriptionId;
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
    if (!sub) return { error: 'Subscription not found' };
    if (sub.status !== 'frozen') return { error: 'Subscription is not frozen' };

    const targetClientId = clientId || sub.client_id;
    const runUnfreeze = db.transaction(() => {
      const result = applyUnfreeze(sub);

      db.prepare(`
        UPDATE clients
        SET status = 'active',
            is_frozen = 0,
            end_date = ?
        WHERE id = ?
      `).run(result.end_date, targetClientId);

      return result;
    });

    const result = runUnfreeze();
    db.syncAllSubscriptionStatuses(db);
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

    // Log regular checkin
    try {
      db.prepare(`
        INSERT INTO checkins (client_id, checkin_time, notes) 
        VALUES (?, datetime('now', 'localtime'), ?)
      `).run(client.id, 'Regular checkin');
    } catch (e) {}

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

ipcMain.handle('checkin:create', async (event, { clientId, notes }) => {
  try {
    db.prepare(`
      INSERT INTO checkins (client_id, checkin_time, notes) 
      VALUES (?, datetime('now', 'localtime'), ?)
    `).run(clientId, notes || 'Regular checkin');

    db.syncAllSubscriptionStatuses(db);
    return { success: true };
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

ipcMain.handle('subscriptions:delete', async (event, args = {}) => {
  try {
    const { clientId, client_id, subscriptionId, subscription_id, id } = (args && typeof args === 'object') ? args : {};
    const subId = subscriptionId || id || subscription_id;
    if (!subId) return { success: false, error: 'Subscription ID is required' };

    const runVoid = db.transaction(() => {
      // 1. Fetch subscription details to know what to deduct
      const sub = db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(subId);
      if (!sub) throw new Error('Subscription not found');
      const targetClientId = clientId || client_id || sub.client_id;

      // 2. Delete associated transactions (created around this subscription)
      try {
        db.prepare(`DELETE FROM transactions WHERE subscription_id = ?`).run(subId);
      } catch (e) {
        try {
          db.prepare(`DELETE FROM transactions WHERE client_id = ? AND created_at = ?`).run(targetClientId, sub.created_at);
        } catch (e2) {}
      }

      // Also clean up any transactions matching payments of this subscription
      try {
        const payments = db.prepare(`SELECT * FROM payments WHERE subscription_id = ?`).all(subId);
        for (const p of payments) {
          try {
            const tx = db.prepare(`
              SELECT id FROM transactions 
              WHERE client_id = ? AND amount = ? 
              ORDER BY id DESC LIMIT 1
            `).get(targetClientId, p.amount);
            if (tx) {
              db.prepare(`DELETE FROM transactions WHERE id = ?`).run(tx.id);
            }
          } catch (e) {}
        }
      } catch (e) {}

      // Delete payments
      db.prepare(`DELETE FROM payments WHERE subscription_id = ?`).run(subId);

      // 3. Delete the subscription itself
      db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(subId);

      // 4. Recalculate client remaining debt
      const debtAgg = db.prepare(`
        SELECT COALESCE(SUM(remaining_amount), 0) AS total_debt 
        FROM subscriptions 
        WHERE client_id = ?
      `).get(targetClientId);
      const newDebt = debtAgg ? debtAgg.total_debt : 0;

      // 5. Rollback client start_date, end_date, and status to the latest remaining subscription (if any)
      const previousSub = db.prepare(`
        SELECT * FROM subscriptions 
        WHERE client_id = ? 
        ORDER BY end_date DESC, id DESC 
        LIMIT 1
      `).get(targetClientId);

      if (previousSub) {
        db.prepare(`
          UPDATE clients 
          SET start_date = ?, end_date = ?, status = ?, remaining_debt = ? 
          WHERE id = ?
        `).run(previousSub.start_date, previousSub.end_date, previousSub.status || 'active', newDebt, targetClientId);
      } else {
        // No remaining subscriptions -> Set to NO PLAN / INACTIVE
        db.prepare(`
          UPDATE clients 
          SET start_date = NULL, end_date = NULL, status = 'active', remaining_debt = ? 
          WHERE id = ?
        `).run(newDebt, targetClientId);
      }

      return true;
    });

    runVoid();
    db.syncAllSubscriptionStatuses(db);
    return { success: true };
  } catch (err) {
    console.error('[subscriptions:delete] Error voiding subscription:', err.message);
    return { success: false, error: err.message };
  }
});
