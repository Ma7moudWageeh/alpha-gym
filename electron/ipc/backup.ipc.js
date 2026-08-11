const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('../db');

function formatCsvField(str) {
  if (str === null || str === undefined) return '""';
  const stringified = String(str).replace(/"/g, '""');
  return `"${stringified}"`;
}

ipcMain.handle('backup:create', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can create backups.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultFilename = `alpha-gym-backup-${today}.db`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath: defaultFilename,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    await db.backup(filePath);

    return { success: true, filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:restore', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can restore backups.' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    const restorePath = filePaths[0];
    const dbPath = path.join(app.getPath('userData'), 'alpha-gym.db');

    // Perform WAL checkpoint to flush current DB
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    // Copy selected backup over live db
    fs.copyFileSync(restorePath, dbPath);

    return { success: true, message: 'Database restored successfully. Please restart the application.' };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:exportClientsCsv', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can export data.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultFilename = `clients-export-${today}.csv`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Clients to CSV',
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV File', extensions: ['csv'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const clients = db.prepare(`
      SELECT 
        c.client_code,
        c.name,
        c.phone,
        c.emergency_contact,
        c.national_id,
        c.gender,
        c.date_of_birth,
        c.weight_kg,
        c.registered_at,
        (SELECT s.status FROM subscriptions s WHERE s.client_id = c.id ORDER BY s.id DESC LIMIT 1) as status,
        (SELECT p.title FROM subscriptions s JOIN packages p ON s.package_id = p.id WHERE s.client_id = c.id ORDER BY s.id DESC LIMIT 1) as active_package,
        (SELECT s.end_date FROM subscriptions s WHERE s.client_id = c.id ORDER BY s.id DESC LIMIT 1) as expiry_date
      FROM clients c
      ORDER BY c.id ASC
    `).all();

    const headers = ['Client Code', 'Full Name', 'Phone', 'Emergency Contact', 'National ID', 'Gender', 'Date of Birth', 'Weight (kg)', 'Status', 'Package', 'Expiry Date', 'Registered At'];
    const rows = [headers.join(',')];

    for (const c of clients) {
      const row = [
        formatCsvField(c.client_code),
        formatCsvField(c.name),
        formatCsvField(c.phone),
        formatCsvField(c.emergency_contact),
        formatCsvField(c.national_id),
        formatCsvField(c.gender),
        formatCsvField(c.date_of_birth),
        formatCsvField(c.weight_kg),
        formatCsvField(c.status || 'Inactive'),
        formatCsvField(c.active_package || '-'),
        formatCsvField(c.expiry_date || '-'),
        formatCsvField(c.registered_at)
      ];
      rows.push(row.join(','));
    }

    fs.writeFileSync(filePath, rows.join('\n'), 'utf8');

    return { success: true, filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:exportFinancialsCsv', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can export data.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultFilename = `financials-export-${today}.csv`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Financial Ledger to CSV',
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV File', extensions: ['csv'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const payments = db.prepare(`
      SELECT 
        'INCOME' as record_type,
        p.paid_at as date,
        c.name as party_name,
        c.client_code as ref_code,
        COALESCE(pkg.title, p.type) as category_or_package,
        p.note as description,
        p.amount
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN packages pkg ON s.package_id = pkg.id
    `).all();

    const expenses = db.prepare(`
      SELECT 
        'EXPENSE' as record_type,
        expense_date as date,
        'Vendor / Operational' as party_name,
        '-' as ref_code,
        COALESCE(category, 'Miscellaneous') as category_or_package,
        title || COALESCE(' - ' || description, '') as description,
        -amount as amount
      FROM expenses
    `).all();

    const allRecords = [...payments, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = ['Record Type', 'Date', 'Party / Client', 'Ref Code', 'Category / Package', 'Description', 'Amount ($)'];
    const rows = [headers.join(',')];

    for (const r of allRecords) {
      const row = [
        formatCsvField(r.record_type),
        formatCsvField(r.date),
        formatCsvField(r.party_name),
        formatCsvField(r.ref_code),
        formatCsvField(r.category_or_package),
        formatCsvField(r.description),
        formatCsvField(r.amount)
      ];
      rows.push(row.join(','));
    }

    fs.writeFileSync(filePath, rows.join('\n'), 'utf8');

    return { success: true, filePath };
  } catch (err) {
    return { error: err.message };
  }
});
