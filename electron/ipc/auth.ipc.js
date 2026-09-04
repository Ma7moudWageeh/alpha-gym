const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const db = require('../db');

const SALT_ROUNDS = 12;

function getUserPinHash(user) {
  return user.security_pin || user.master_pin || null;
}

ipcMain.handle('auth:checkOwnerExists', async () => {
  try {
    const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'").get();
    return { exists: row.count > 0 };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:setupOwner', async (event, { fullName, username, password, masterPin }) => {
  try {
    const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'").get();
    if (row.count > 0) {
      return { error: 'Owner already exists.' };
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const pinHash = bcrypt.hashSync(masterPin, SALT_ROUNDS);

    const insert = db.prepare(`
      INSERT INTO users (full_name, username, password, role, master_pin, security_pin)
      VALUES (?, ?, ?, 'owner', ?, ?)
    `);

    insert.run(fullName, username, passwordHash, pinHash, pinHash);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:login', async (event, { username, password }) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return { error: 'Invalid username or password.' };
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return { error: 'Invalid username or password.' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role
      }
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:verifyPin', async (event, { pin }) => {
  try {
    const owner = db.prepare("SELECT * FROM users WHERE role = 'owner' LIMIT 1").get();
    if (!owner) {
      return { error: 'Owner not found.' };
    }

    const pinHash = getUserPinHash(owner);
    if (!pinHash) {
      return { error: 'Security PIN not configured.' };
    }

    const isValid = bcrypt.compareSync(pin, pinHash);
    if (!isValid) {
      return { error: 'Invalid PIN.' };
    }

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:verifyCredentialsPin', async (event, { username, pin }) => {
  try {
    if (!username || !pin) {
      return { error: 'Username and Security PIN are required.' };
    }

    const user = db.prepare('SELECT id, username, security_pin, master_pin FROM users WHERE username = ?').get(username);
    if (!user) {
      return { error: 'Invalid username or Security PIN.' };
    }

    const pinHash = getUserPinHash(user);
    if (!pinHash) {
      return { error: 'Security PIN not configured for this account.' };
    }

    const isValid = bcrypt.compareSync(pin, pinHash);
    if (!isValid) {
      return { error: 'Invalid username or Security PIN.' };
    }

    return { success: true, userId: user.id, username: user.username };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:resetPassword', async (event, { username, newPassword, pin }) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return { error: 'User not found.' };
    }

    const pinHash = getUserPinHash(user);
    if (!pinHash) {
      return { error: 'Security PIN not configured for this account.' };
    }

    const isValidPin = bcrypt.compareSync(pin, pinHash);
    if (!isValidPin) {
      return { error: 'Invalid PIN.' };
    }

    const passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE username = ?').run(passwordHash, username);

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role
      }
    };
  } catch (err) {
    return { error: err.message };
  }
});

// Staff Management
ipcMain.handle('auth:getUsers', async () => {
  try {
    const users = db.prepare(
      'SELECT id, full_name, username, role, created_at FROM users ORDER BY role DESC, id ASC'
    ).all();
    return { success: true, users };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:createAdmin', async (event, { fullName, username, password, requestingRole }) => {
  try {
    if (requestingRole !== 'owner') {
      return { error: 'Unauthorized: Only owners can create staff accounts.' };
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return { error: `Username "${username}" is already taken.` };
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const info = db.prepare(
      "INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, 'admin')"
    ).run(fullName, username, passwordHash);

    return { success: true, id: info.lastInsertRowid };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('auth:deleteUser', async (event, { id, requestingRole }) => {
  try {
    if (requestingRole !== 'owner') {
      return { error: 'Unauthorized.' };
    }
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
    if (!user) return { error: 'User not found.' };
    if (user.role === 'owner') return { error: 'Cannot delete the owner account.' };
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
