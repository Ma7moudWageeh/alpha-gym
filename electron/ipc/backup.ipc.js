const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const AdmZip = require('adm-zip');
const db = require('../db');
const { sanitizeClientCodes } = require('../schema');

function formatCsvField(str) {
  if (str === null || str === undefined) return '""';
  const stringified = String(str).replace(/"/g, '""');
  return `"${stringified}"`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ARCHIVE ENGINE (BACKUP & RESTORE)
// ══════════════════════════════════════════════════════════════════════════════

async function createBackupArchive(targetZipPath) {
  // 1. Flush active WAL journal to ensure 100% data consistency
  try {
    db.pragma('wal_checkpoint(FULL)');
  } catch (e) {
    console.warn('[backup] WAL checkpoint warning:', e.message);
  }

  const userData = app.getPath('userData');
  const tempStaging = path.join(userData, `temp_staging_${Date.now()}`);
  if (!fs.existsSync(tempStaging)) {
    fs.mkdirSync(tempStaging, { recursive: true });
  }

  try {
    // 2. Export clean locked-free snapshot of the SQLite database
    const stagingDbPath = path.join(tempStaging, 'alpha-gym.db');
    if (typeof db.backup === 'function') {
      await db.backup(stagingDbPath);
    } else {
      const liveDb = path.join(userData, 'alpha-gym.db');
      fs.copyFileSync(liveDb, stagingDbPath);
    }

    // 3. Stage profile photos
    const stagingPhotos = path.join(tempStaging, 'photos');
    fs.mkdirSync(stagingPhotos, { recursive: true });

    const photoDirs = [
      path.join(userData, 'client-photos'),
      path.join(userData, 'photos')
    ];

    let photosCount = 0;
    for (const pDir of photoDirs) {
      if (fs.existsSync(pDir)) {
        const files = fs.readdirSync(pDir);
        for (const f of files) {
          const src = path.join(pDir, f);
          const dest = path.join(stagingPhotos, f);
          if (fs.existsSync(src) && fs.statSync(src).isFile()) {
            try {
              fs.copyFileSync(src, dest);
              photosCount++;
            } catch (copyErr) {}
          }
        }
      }
    }

    // 4. Gather system settings, WhatsApp configurations, and statistics
    let totalMembers = 0;
    try {
      const countRow = db.prepare('SELECT COUNT(*) as c FROM clients').get();
      totalMembers = countRow ? countRow.c : 0;
    } catch (e) {}

    let allSettings = {};
    try {
      const settingsRows = db.prepare('SELECT key, value FROM settings').all();
      for (const s of settingsRows) {
        allSettings[s.key] = s.value;
      }
    } catch (e) {}

    const manifest = {
      app: 'Alpha Gym',
      version: app.getVersion() || '1.0.12',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      totalMembers,
      photosCount,
      settings: allSettings
    };

    fs.writeFileSync(path.join(tempStaging, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 5. Compress staging folder into target zip archive
    const zip = new AdmZip();
    zip.addLocalFile(stagingDbPath);
    if (fs.existsSync(stagingPhotos)) {
      zip.addLocalFolder(stagingPhotos, 'photos');
    }
    zip.addLocalFile(path.join(tempStaging, 'manifest.json'));

    const targetDir = path.dirname(targetZipPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    zip.writeZip(targetZipPath);

    const stats = fs.statSync(targetZipPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      filePath: targetZipPath,
      fileName: path.basename(targetZipPath),
      sizeMB,
      totalMembers,
      photosCount
    };
  } finally {
    // Clean up temporary staging
    try {
      if (fs.existsSync(tempStaging)) {
        fs.rmSync(tempStaging, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

async function restoreBackupArchive(zipFilePath) {
  if (!fs.existsSync(zipFilePath)) {
    throw new Error('Selected backup archive does not exist.');
  }

  const userData = app.getPath('userData');
  const tempVerify = path.join(userData, `temp_restore_verify_${Date.now()}`);
  const preRestoreBackup = path.join(userData, 'pre_restore_backup');

  // 1. Create emergency safety snapshot before touching any live data
  try {
    if (fs.existsSync(preRestoreBackup)) {
      fs.rmSync(preRestoreBackup, { recursive: true, force: true });
    }
    fs.mkdirSync(preRestoreBackup, { recursive: true });

    try { db.pragma('wal_checkpoint(FULL)'); } catch (e) {}

    const liveDbPath = path.join(userData, 'alpha-gym.db');
    if (fs.existsSync(liveDbPath)) {
      fs.copyFileSync(liveDbPath, path.join(preRestoreBackup, 'alpha-gym.db'));
    }

    const livePhotos = path.join(userData, 'client-photos');
    if (fs.existsSync(livePhotos)) {
      const backupPhotos = path.join(preRestoreBackup, 'photos');
      fs.mkdirSync(backupPhotos, { recursive: true });
      for (const f of fs.readdirSync(livePhotos)) {
        const src = path.join(livePhotos, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(backupPhotos, f));
        }
      }
    }
  } catch (safetyErr) {
    console.warn('[backup:restore] Safety snapshot warning:', safetyErr.message);
  }

  // 2. Unpack selected zip into verification directory
  fs.mkdirSync(tempVerify, { recursive: true });
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(tempVerify, true);

  // 3. Locate SQLite database file inside archive
  let candidateDb = path.join(tempVerify, 'alpha-gym.db');
  if (!fs.existsSync(candidateDb)) {
    candidateDb = path.join(tempVerify, 'alpha_gym.db');
  }
  if (!fs.existsSync(candidateDb)) {
    const allFiles = fs.readdirSync(tempVerify);
    const dbMatch = allFiles.find(f => f.endsWith('.db') || f.endsWith('.sqlite'));
    if (dbMatch) {
      candidateDb = path.join(tempVerify, dbMatch);
    }
  }

  if (!fs.existsSync(candidateDb)) {
    throw new Error('No valid SQLite database file found inside the backup archive.');
  }

  // 4. Run SQLite integrity check on candidate DB
  const tempDb = new Database(candidateDb);
  const check = tempDb.pragma('integrity_check');
  tempDb.close();
  if (!check || check[0]?.integrity_check !== 'ok') {
    throw new Error('Database inside the backup is corrupted or failed SQLite integrity check.');
  }

  // 5. Close running live application database
  try {
    db.close();
  } catch (e) {
    console.warn('[backup:restore] Warning closing active DB:', e.message);
  }

  // 6. Replace live database file and remove stale WAL / SHM journals
  const liveDbPath = path.join(userData, 'alpha-gym.db');
  fs.copyFileSync(candidateDb, liveDbPath);

  const walPath = path.join(userData, 'alpha-gym.db-wal');
  const shmPath = path.join(userData, 'alpha-gym.db-shm');
  try { if (fs.existsSync(walPath)) fs.unlinkSync(walPath); } catch (e) {}
  try { if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath); } catch (e) {}

  // 7. Unpack & merge athlete profile photos
  const unpackedPhotos = path.join(tempVerify, 'photos');
  const targetPhotosDirs = [
    path.join(userData, 'client-photos'),
    path.join(userData, 'photos')
  ];

  if (fs.existsSync(unpackedPhotos)) {
    for (const targetDir of targetPhotosDirs) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const files = fs.readdirSync(unpackedPhotos);
      for (const f of files) {
        const src = path.join(unpackedPhotos, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(targetDir, f));
        }
      }
    }
  }

  // 8. Clean up temp verification folder
  try {
    fs.rmSync(tempVerify, { recursive: true, force: true });
  } catch (e) {}

  // 9. Automatically relaunch the application to mount the restored database
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 1000);

  return { success: true, message: 'Database and assets restored successfully. Relaunching application...' };
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTOMATED DAILY ROLLING SNAPSHOTS (LAST 7 DAYS)
// ══════════════════════════════════════════════════════════════════════════════

async function runAutoDailyBackup() {
  try {
    const userData = app.getPath('userData');
    const autoBackupsDir = path.join(userData, 'auto_backups');
    if (!fs.existsSync(autoBackupsDir)) {
      fs.mkdirSync(autoBackupsDir, { recursive: true });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayBackupFile = path.join(autoBackupsDir, `auto_backup_${todayStr}.zip`);

    if (!fs.existsSync(todayBackupFile)) {
      console.log(`[AutoBackup] Generating daily rolling snapshot: auto_backup_${todayStr}.zip`);
      await createBackupArchive(todayBackupFile);
    }

    // Retain strictly the last 7 daily snapshots
    const files = fs.readdirSync(autoBackupsDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.zip'))
      .map(f => ({
        name: f,
        fullPath: path.join(autoBackupsDir, f),
        time: fs.statSync(path.join(autoBackupsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 7) {
      for (let i = 7; i < files.length; i++) {
        try {
          fs.unlinkSync(files[i].fullPath);
          console.log(`[AutoBackup] Pruned older backup: ${files[i].name}`);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('[AutoBackup] Error executing auto snapshot:', err.message);
  }
}

// Trigger daily snapshot silently 5 seconds after startup
setTimeout(() => {
  runAutoDailyBackup();
}, 5000);

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('backup:exportFull', async (event, args = {}) => {
  try {
    const { userRole } = (args && typeof args === 'object') ? args : {};
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can export full backups.' };
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultFilename = `AlphaGym_Backup_${dateStr}_${timeStr}.zip`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Full System Backup Package',
      defaultPath: defaultFilename,
      filters: [{ name: 'Zip Archives (*.zip)', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const result = await createBackupArchive(filePath);
    return result;
  } catch (err) {
    console.error('[backup:exportFull] Error:', err);
    return { error: err.message };
  }
});

ipcMain.handle('backup:restoreFull', async (event, args = {}) => {
  try {
    const { userRole, filePath } = (args && typeof args === 'object') ? args : {};
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can restore backups.' };
    }

    let targetPath = filePath;
    if (!targetPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Full Backup Package to Restore',
        properties: ['openFile'],
        filters: [{ name: 'Backup Archives (*.zip, *.agbackup)', extensions: ['zip', 'agbackup'] }]
      });

      if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
      targetPath = filePaths[0];
    }

    const result = await restoreBackupArchive(targetPath);
    return result;
  } catch (err) {
    console.error('[backup:restoreFull] Error:', err);
    return { error: err.message };
  }
});

// Backward-compatible aliases
ipcMain.handle('backup:create', async (event, args = {}) => {
  try {
    const { userRole } = (args && typeof args === 'object') ? args : {};
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can create backups.' };
    }
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultFilename = `AlphaGym_Backup_${dateStr}_${timeStr}.zip`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Full Backup',
      defaultPath: defaultFilename,
      filters: [{ name: 'Zip Archives (*.zip)', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return { canceled: true };
    return await createBackupArchive(filePath);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:restore', async (event, args = {}) => {
  try {
    const { userRole, filePath } = (args && typeof args === 'object') ? args : {};
    if (userRole && userRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can restore backups.' };
    }

    let targetPath = filePath;
    if (!targetPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Backup to Restore',
        properties: ['openFile'],
        filters: [{ name: 'Backup Archives (*.zip, *.agbackup, *.db)', extensions: ['zip', 'agbackup', 'db', 'sqlite'] }]
      });
      if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
      targetPath = filePaths[0];
    }

    if (targetPath.endsWith('.zip') || targetPath.endsWith('.agbackup')) {
      return await restoreBackupArchive(targetPath);
    } else {
      // Legacy SQLite file restore
      const userData = app.getPath('userData');
      const dbPath = path.join(userData, 'alpha-gym.db');
      try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
      try { db.close(); } catch (e) {}
      fs.copyFileSync(targetPath, dbPath);
      setTimeout(() => { app.relaunch(); app.exit(0); }, 1000);
      return { success: true, message: 'Database restored successfully. Relaunching application...' };
    }
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('backup:getAutoBackupsList', async () => {
  try {
    const userData = app.getPath('userData');
    const autoBackupsDir = path.join(userData, 'auto_backups');
    if (!fs.existsSync(autoBackupsDir)) {
      return { success: true, latestBackup: null, backups: [] };
    }

    const files = fs.readdirSync(autoBackupsDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const fullPath = path.join(autoBackupsDir, f);
        const stats = fs.statSync(fullPath);
        return {
          fileName: f,
          fullPath,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.mtime.toISOString(),
          date: stats.mtime.toISOString().split('T')[0],
          time: stats.mtime.toLocaleTimeString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      latestBackup: files.length > 0 ? files[0] : null,
      backups: files
    };
  } catch (err) {
    return { success: false, error: err.message, latestBackup: null, backups: [] };
  }
});

ipcMain.handle('backup:getBackupInfo', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { error: 'File not found.' };
    }
    const zip = new AdmZip(filePath);
    const manifestEntry = zip.getEntry('manifest.json');
    if (manifestEntry) {
      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
      return { success: true, manifest };
    }
    return { success: true, manifest: null };
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
