const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { sanitizeClientCodes } = require('../schema');

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

ipcMain.handle('backup:exportJson', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can export JSON data.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Data (JSON)',
      defaultPath: `alpha-gym-export-${today}.json`,
      filters: [{ name: 'JSON File', extensions: ['json'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      packages: db.prepare('SELECT * FROM packages').all(),
      clients: db.prepare('SELECT * FROM clients').all(),
      subscriptions: db.prepare('SELECT * FROM subscriptions').all(),
      payments: db.prepare('SELECT * FROM payments').all(),
      expenses: db.prepare('SELECT * FROM expenses').all(),
      body_progress: db.prepare('SELECT * FROM body_progress').all(),
      users: db.prepare('SELECT id, full_name, username, role, created_at FROM users').all(),
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { success: true, filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:importJson', async (event, { userRole }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can import JSON data.' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Data (JSON)',
      properties: ['openFile'],
      filters: [{ name: 'JSON File', extensions: ['json'] }]
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    } catch (e) {
      return { error: 'Invalid JSON file.' };
    }

    if (!data || typeof data !== 'object') {
      return { error: 'Invalid export format.' };
    }
    if (data.schemaVersion !== 1) {
      return { error: `Unsupported schema version: ${data.schemaVersion || 'unknown'}` };
    }

    const counts = {
      packages: 0, clients: 0, subscriptions: 0, payments: 0, expenses: 0, body_progress: 0,
    };

    const importTxn = db.transaction(() => {
      for (const pkg of data.packages || []) {
        db.prepare(`
          INSERT INTO packages (id, title, description, duration_days, default_price, is_active, created_at)
          VALUES (@id, @title, @description, @duration_days, @default_price, @is_active, @created_at)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, description=excluded.description,
            duration_days=excluded.duration_days, default_price=excluded.default_price,
            is_active=excluded.is_active
        `).run({
          id: pkg.id,
          title: pkg.title,
          description: pkg.description || null,
          duration_days: pkg.duration_days,
          default_price: pkg.default_price,
          is_active: pkg.is_active ?? 1,
          created_at: pkg.created_at || new Date().toISOString(),
        });
        counts.packages += 1;
      }

      for (const c of data.clients || []) {
        db.prepare(`
          INSERT INTO clients (
            id, name, phone, date_of_birth, height_cm, weight_kg, area, other_sports,
            injuries, has_conditions, medical_details, client_code, emergency_contact,
            national_id, gender, notes, profile_photo, registered_at
          ) VALUES (
            @id, @name, @phone, @date_of_birth, @height_cm, @weight_kg, @area, @other_sports,
            @injuries, @has_conditions, @medical_details, @client_code, @emergency_contact,
            @national_id, @gender, @notes, @profile_photo, @registered_at
          )
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, phone=excluded.phone, date_of_birth=excluded.date_of_birth,
            height_cm=excluded.height_cm, weight_kg=excluded.weight_kg, area=excluded.area,
            other_sports=excluded.other_sports, injuries=excluded.injuries,
            has_conditions=excluded.has_conditions, medical_details=excluded.medical_details,
            client_code=excluded.client_code, emergency_contact=excluded.emergency_contact,
            national_id=excluded.national_id, gender=excluded.gender, notes=excluded.notes,
            profile_photo=excluded.profile_photo
        `).run({
          id: c.id,
          name: c.name,
          phone: c.phone,
          date_of_birth: c.date_of_birth || null,
          height_cm: c.height_cm || null,
          weight_kg: c.weight_kg || 0,
          area: c.area || null,
          other_sports: c.other_sports || null,
          injuries: c.injuries || null,
          has_conditions: c.has_conditions ? 1 : 0,
          medical_details: c.medical_details || null,
          client_code: c.client_code || null,
          emergency_contact: c.emergency_contact || null,
          national_id: c.national_id || null,
          gender: c.gender || null,
          notes: c.notes || null,
          profile_photo: c.profile_photo || null,
          registered_at: c.registered_at || new Date().toISOString(),
        });
        counts.clients += 1;
      }

      for (const s of data.subscriptions || []) {
        db.prepare(`
          INSERT INTO subscriptions (
            id, client_id, package_id, start_date, end_date, price, status,
            frozen_on, frozen_days, freeze_reason, freeze_mode, freeze_end_date, created_at
          ) VALUES (
            @id, @client_id, @package_id, @start_date, @end_date, @price, @status,
            @frozen_on, @frozen_days, @freeze_reason, @freeze_mode, @freeze_end_date, @created_at
          )
          ON CONFLICT(id) DO UPDATE SET
            client_id=excluded.client_id, package_id=excluded.package_id,
            start_date=excluded.start_date, end_date=excluded.end_date, price=excluded.price,
            status=excluded.status, frozen_on=excluded.frozen_on, frozen_days=excluded.frozen_days,
            freeze_reason=excluded.freeze_reason, freeze_mode=excluded.freeze_mode,
            freeze_end_date=excluded.freeze_end_date
        `).run({
          id: s.id,
          client_id: s.client_id,
          package_id: s.package_id || null,
          start_date: s.start_date,
          end_date: s.end_date,
          price: s.price,
          status: s.status || 'active',
          frozen_on: s.frozen_on || null,
          frozen_days: s.frozen_days || 0,
          freeze_reason: s.freeze_reason || null,
          freeze_mode: s.freeze_mode || null,
          freeze_end_date: s.freeze_end_date || null,
          created_at: s.created_at || new Date().toISOString(),
        });
        counts.subscriptions += 1;
      }

      for (const p of data.payments || []) {
        db.prepare(`
          INSERT INTO payments (id, client_id, subscription_id, amount, type, note, paid_at)
          VALUES (@id, @client_id, @subscription_id, @amount, @type, @note, @paid_at)
          ON CONFLICT(id) DO UPDATE SET
            client_id=excluded.client_id, subscription_id=excluded.subscription_id,
            amount=excluded.amount, type=excluded.type, note=excluded.note, paid_at=excluded.paid_at
        `).run({
          id: p.id,
          client_id: p.client_id,
          subscription_id: p.subscription_id || null,
          amount: p.amount,
          type: p.type || 'subscription',
          note: p.note || null,
          paid_at: p.paid_at || new Date().toISOString(),
        });
        counts.payments += 1;
      }

      for (const e of data.expenses || []) {
        db.prepare(`
          INSERT INTO expenses (id, title, amount, category, description, expense_date, created_at)
          VALUES (@id, @title, @amount, @category, @description, @expense_date, @created_at)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, amount=excluded.amount, category=excluded.category,
            description=excluded.description, expense_date=excluded.expense_date
        `).run({
          id: e.id,
          title: e.title,
          amount: e.amount,
          category: e.category || null,
          description: e.description || null,
          expense_date: e.expense_date,
          created_at: e.created_at || new Date().toISOString(),
        });
        counts.expenses += 1;
      }

      for (const b of data.body_progress || []) {
        db.prepare(`
          INSERT INTO body_progress (id, client_id, weight_kg, notes, logged_at)
          VALUES (@id, @client_id, @weight_kg, @notes, @logged_at)
          ON CONFLICT(id) DO UPDATE SET
            client_id=excluded.client_id, weight_kg=excluded.weight_kg,
            notes=excluded.notes, logged_at=excluded.logged_at
        `).run({
          id: b.id,
          client_id: b.client_id,
          weight_kg: b.weight_kg || null,
          notes: b.notes || null,
          logged_at: b.logged_at || new Date().toISOString(),
        });
        counts.body_progress += 1;
      }
    });

    importTxn();
    sanitizeClientCodes(db);
    return { success: true, counts, message: 'JSON data imported successfully.' };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:factoryReset', async (event, { userRole, confirmationPhrase }) => {
  try {
    if (userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can reset application data.' };
    }
    if (confirmationPhrase !== 'DELETE ALL DATA') {
      return { error: 'Confirmation phrase does not match. Type DELETE ALL DATA exactly.' };
    }

    const resetTxn = db.transaction(() => {
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM body_progress').run();
      db.prepare('DELETE FROM subscriptions').run();
      db.prepare('DELETE FROM expenses').run();
      db.prepare('DELETE FROM alerts').run();
      db.prepare('DELETE FROM clients').run();
      db.prepare("DELETE FROM users WHERE role != 'owner'").run();
      db.prepare('DELETE FROM packages').run();
      const insertPkg = db.prepare('INSERT INTO packages (title, duration_days, default_price) VALUES (?, ?, ?)');
      insertPkg.run('1 Month', 30, 200);
      insertPkg.run('3 Months', 90, 500);
      insertPkg.run('Annual', 365, 1500);
    });

    resetTxn();
    return { success: true, message: 'All application data has been reset. Owner account retained.' };
  } catch (err) {
    return { error: err.message };
  }
});
