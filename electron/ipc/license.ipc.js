const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { getMachineId, verifyLicense, decrypt } = require('../utils/license');

ipcMain.handle('license:getMachineId', async () => {
  return getMachineId();
});

ipcMain.handle('license:checkStatus', async () => {
  return verifyLicense();
});

ipcMain.handle('license:activate', async (event, { licenseKey }) => {
  try {
    // Decrypt to verify it's a valid key format
    const decryptedStr = decrypt(licenseKey);
    const payload = JSON.parse(decryptedStr);
    
    // Validate for current machine
    const currentMachineId = getMachineId();
    if (payload.machineId !== currentMachineId) {
      return { success: false, error: 'License key is for a different machine.' };
    }

    const todayDate = new Date().toISOString().split('T')[0];
    if (todayDate > payload.expiryDate) {
      return { success: false, error: 'License key has expired.' };
    }

    // Write to file
    const userDataPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : process.cwd();
    const licensePath = path.join(userDataPath, 'alpha_gym.lic');
    fs.writeFileSync(licensePath, licenseKey, 'utf8');

    return { success: true };
  } catch (err) {
    if (err.message === 'DECRYPTION_FAILED') {
      return { success: false, error: 'DECRYPTION_FAILED' };
    }
    return { success: false, error: 'Invalid license key format.' };
  }
});
