const { ipcMain } = require('electron');
const db = require('../db');

function getDateConditions(timeframe, customMonth) {
  const today = new Date().toISOString().split('T')[0];
  if (timeframe === 'today') {
    return {
      payCond: "date(paid_at) = ?",
      expCond: "date(expense_date) = ?",
      params: [today]
    };
  } else if (timeframe === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekAgo = d.toISOString().split('T')[0];
    return {
      payCond: "date(paid_at) >= ?",
      expCond: "date(expense_date) >= ?",
      params: [weekAgo]
    };
  } else if (timeframe === 'custom_month' && customMonth) {
    return {
      payCond: "strftime('%Y-%m', paid_at) = ?",
      expCond: "strftime('%Y-%m', expense_date) = ?",
      params: [customMonth]
    };
  } else if (timeframe === 'month') {
    const monthStart = today.substring(0, 7) + '-01';
    return {
      payCond: "date(paid_at) >= ?",
      expCond: "date(expense_date) >= ?",
      params: [monthStart]
    };
  }
  return {
    payCond: "1=1",
    expCond: "1=1",
    params: []
  };
}

ipcMain.handle('reports:getSummary', async (event, { timeframe = 'month', customMonth } = {}) => {
  try {
    const { payCond, expCond, params } = getDateConditions(timeframe, customMonth);

    const revenueRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${payCond}`).get(...params);
    const expenseRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${expCond}`).get(...params);

    const revenue = revenueRow.total;
    const expenses = expenseRow.total;
    const netProfit = revenue - expenses;

    return {
      success: true,
      summary: {
        timeframe,
        revenue,
        expenses,
        netProfit
      }
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('reports:getDashboardMetrics', async (event, { timeframe = 'month', customMonth } = {}) => {
    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active'").run();
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';
    const target7Days = new Date();
    target7Days.setDate(target7Days.getDate() + 7);
    const target7DaysStr = target7Days.toISOString().split('T')[0];

    // Total Active Members
    db.syncAllSubscriptionStatuses(db);
    const activeSubCountRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'active' AND DATE(end_date) >= DATE('now', 'localtime')").get();

    // Total Frozen Members
    const frozenSubCountRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'frozen'").get();
    const expiredCountRow = db.prepare(`
      SELECT COUNT(DISTINCT client_id) as count
      FROM subscriptions
      WHERE (status = 'expired' OR (status = 'active' AND DATE(end_date) < DATE('now', 'localtime')))
        AND DATE(end_date) >= DATE('now', '-30 days', 'localtime')
    `).get();
    
    // Today's Revenue
    const todayRevenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date(paid_at) = ?").get(today);

    // Monthly Revenue
    const monthRevenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date(paid_at) >= ?").get(monthStart);

    // Expiring Soon (7 Days)
    const expiringCountRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'active' AND DATE(end_date) BETWEEN DATE('now', 'localtime') AND DATE('now', 'localtime', '+7 days')").get();

    // Package Popularity
    const packageStats = db.prepare(`
      SELECT 
        p.title, 
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.price), 0) as total_revenue
      FROM packages p
      LEFT JOIN subscriptions s ON p.id = s.package_id
      GROUP BY p.id
      ORDER BY sales_count DESC
    `).all();

    return {
      success: true,
      metrics: {
        activeMembers: activeSubCountRow.count,
        frozenMembers: frozenSubCountRow.count,
        todayRevenue: todayRevenueRow.total,
        monthRevenue: monthRevenueRow.total,
        expiringSoon: expiringCountRow.count,
        packageStats
      }
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('reports:getClientDistribution', async () => {
  try {
    const totalClientsRow = db.prepare("SELECT COUNT(*) as count FROM clients").get();
    const totalClients = totalClientsRow.count || 1; // avoid divide by zero

    const activeRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'active'").get();
    const frozenRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'frozen'").get();
    const expiredRow = db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'expired'").get();

    const activeCount = activeRow.count;
    const frozenCount = frozenRow.count;
    const expiredCount = expiredRow.count;
    const inactiveCount = Math.max(0, totalClients - (activeCount + frozenCount));

    return {
      success: true,
      distribution: {
        totalClients,
        active: { count: activeCount, percentage: ((activeCount / totalClients) * 100).toFixed(1) },
        frozen: { count: frozenCount, percentage: ((frozenCount / totalClients) * 100).toFixed(1) },
        expired: { count: expiredCount, percentage: ((expiredCount / totalClients) * 100).toFixed(1) },
        inactive: { count: inactiveCount, percentage: ((inactiveCount / totalClients) * 100).toFixed(1) }
      }
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('reports:getHistoricalMonthlyData', async (event, { selectedMonth } = {}) => {
  try {
    const dbTransaction = db.transaction(() => {
      // Find the earliest date
      const earliestRow = db.prepare(`
        SELECT MIN(date) as first_date FROM (
          SELECT date(paid_at) as date FROM payments
          UNION ALL
          SELECT date(expense_date) as date FROM expenses
          UNION ALL
          SELECT date(start_date) as date FROM subscriptions
        )
      `).get();

      let firstDate = earliestRow.first_date;
      if (!firstDate) {
        firstDate = new Date().toISOString().split('T')[0];
      }
      
      const firstMonthStr = firstDate.substring(0, 7);
      const currentMonthStr = new Date().toISOString().substring(0, 7);

      // Generate continuous months array
      let months = [];
      let [year, month] = firstMonthStr.split('-').map(Number);
      const [endYear, endMonth] = currentMonthStr.split('-').map(Number);

      while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}-` + month.toString().padStart(2, '0'));
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      if (selectedMonth) {
        if (!months.includes(selectedMonth)) months = [selectedMonth];
        else months = [selectedMonth];
      }

      const results = [];

      const incomeStmt = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE strftime('%Y-%m', paid_at) = ?`);
      const expenseStmt = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?`);
      const subsCountStmt = db.prepare(`SELECT COUNT(id) as count FROM subscriptions WHERE strftime('%Y-%m', start_date) = ?`);
      
      const incomeItemsStmt = db.prepare(`
        SELECT p.paid_at as date, c.name as client_name, p.type, p.amount, pk.title as package_title
        FROM payments p
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN subscriptions s ON p.subscription_id = s.id
        LEFT JOIN packages pk ON s.package_id = pk.id
        WHERE strftime('%Y-%m', p.paid_at) = ?
        ORDER BY p.paid_at DESC
      `);
      
      const expenseItemsStmt = db.prepare(`
        SELECT expense_date as date, category, description, amount, title
        FROM expenses
        WHERE strftime('%Y-%m', expense_date) = ?
        ORDER BY expense_date DESC
      `);

      for (const m of months) {
        const totalIncome = incomeStmt.get(m).total;
        const totalExpenses = expenseStmt.get(m).total;
        const subscriptionCount = subsCountStmt.get(m).count;
        
        let incomeItems = [];
        let expenseItems = [];
        
        if (selectedMonth) {
          incomeItems = incomeItemsStmt.all(m);
          expenseItems = expenseItemsStmt.all(m);
        }

        results.push({
          month: m,
          totalIncome,
          totalExpenses,
          netProfit: totalIncome - totalExpenses,
          subscriptionCount,
          incomeItems,
          expenseItems
        });
      }

      return results;
    });

    const data = dbTransaction();
    return { success: true, data };
  } catch (err) {
    return { error: err.message };
  }
});
