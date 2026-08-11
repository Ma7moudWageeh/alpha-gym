const fs = require('fs');
const path = require('path');

const ipcDir = path.join(__dirname, 'electron', 'ipc');

// 1. Update subscriptions.ipc.js (Freeze/Unfreeze & Auto-expire sync)
let subPath = path.join(ipcDir, 'subscriptions.ipc.js');
let subContent = fs.readFileSync(subPath, 'utf8');

if (!subContent.includes('syncExpirations')) {
  // Add auto-expire to checkIn
  subContent = subContent.replace(
    /const today = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];/,
    `const today = new Date().toISOString().split('T')[0];\n    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active'").run();`
  );
  
  // Update freeze handler
  subContent = subContent.replace(
    /const today = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];\s*db\.prepare\("UPDATE subscriptions SET status = 'frozen', frozen_on = \? WHERE id = \?"\)\.run\(today, subscription_id\);/g,
    `const today = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE subscriptions SET status = 'frozen', frozen_on = CURRENT_TIMESTAMP WHERE id = ?").run(subscription_id);`
  );

  // Update unfreeze handler
  subContent = subContent.replace(
    /const today = new Date\(\);\s*const frozenDate = sub\.frozen_on \? new Date\(sub\.frozen_on\) : today;\s*const diffTime = Math\.max\(0, Math\.ceil\(\(today - frozenDate\) \/ \(1000 \* 60 \* 60 \* 24\)\)\);\s*\/\/ Extend end date by frozen days\s*const newEndDate = addDays\(sub\.end_date, diffTime\);\s*const totalFrozenDays = \(sub\.frozen_days \|\| 0\) \+ diffTime;/g,
    `// Calculate exactly how many days the subscription was frozen
    const row = db.prepare("SELECT CAST((JULIANDAY('now') - JULIANDAY(frozen_on)) AS INTEGER) as days_frozen FROM subscriptions WHERE id = ?").get(subscription_id);
    const diffTime = Math.max(1, row.days_frozen || 1);

    // Extend end date by frozen days
    const newEndDate = addDays(sub.end_date, diffTime);
    const totalFrozenDays = (sub.frozen_days || 0) + diffTime;`
  );
  
  fs.writeFileSync(subPath, subContent, 'utf8');
}

// 2. Update clients.ipc.js (Auto-expire sync before fetching clients)
let clientsPath = path.join(ipcDir, 'clients.ipc.js');
let clientsContent = fs.readFileSync(clientsPath, 'utf8');
if (!clientsContent.includes("status = 'expired' WHERE DATE(end_date)")) {
  clientsContent = clientsContent.replace(
    /ipcMain\.handle\('clients:getAll', async \(event, \{ search = '', status = 'all' \} = \{\}\) => \{/g,
    `ipcMain.handle('clients:getAll', async (event, { search = '', status = 'all' } = {}) => {\n  db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active'").run();`
  );
  clientsContent = clientsContent.replace(
    /ipcMain\.handle\('clients:getById', async \(event, \{ id \}\) => \{/g,
    `ipcMain.handle('clients:getById', async (event, { id }) => {\n  db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active' AND client_id = ?").run(id);`
  );
  fs.writeFileSync(clientsPath, clientsContent, 'utf8');
}

// 3. Update reports.ipc.js
let reportsPath = path.join(ipcDir, 'reports.ipc.js');
let reportsContent = fs.readFileSync(reportsPath, 'utf8');
if (!reportsContent.includes('custom_month')) {
  reportsContent = reportsContent.replace(
    /function getDateConditions\(timeframe\) \{/,
    `function getDateConditions(timeframe, customMonth) {`
  );
  reportsContent = reportsContent.replace(
    /\} else if \(timeframe === 'month'\) \{/g,
    `} else if (timeframe === 'custom_month' && customMonth) {
    return {
      payCond: "strftime('%Y-%m', paid_at) = ?",
      expCond: "strftime('%Y-%m', expense_date) = ?",
      params: [customMonth]
    };
  } else if (timeframe === 'month') {`
  );
  reportsContent = reportsContent.replace(
    /ipcMain\.handle\('reports:getSummary', async \(event, \{ timeframe = 'month' \} = \{\}\) => \{/g,
    `ipcMain.handle('reports:getSummary', async (event, { timeframe = 'month', customMonth } = {}) => {`
  );
  reportsContent = reportsContent.replace(
    /const \{ payCond, expCond, params \} = getDateConditions\(timeframe\);/g,
    `const { payCond, expCond, params } = getDateConditions(timeframe, customMonth);`
  );
  // Also fix getDashboardMetrics to accept custom ranges
  reportsContent = reportsContent.replace(
    /ipcMain\.handle\('reports:getDashboardMetrics', async \(\) => \{/g,
    `ipcMain.handle('reports:getDashboardMetrics', async (event, { timeframe = 'month', customMonth } = {}) => {\n    db.prepare("UPDATE subscriptions SET status = 'expired' WHERE DATE(end_date) < DATE('now', 'localtime') AND status = 'active'").run();`
  );
  fs.writeFileSync(reportsPath, reportsContent, 'utf8');
}

console.log("Backend IPCs updated.");
