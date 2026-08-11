const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MASTER_SECRET = 'ALPHA_GYM_MASTER_SECRET_2026_SECURE_KEY';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getMachineId() {
  try {
    let output = '';
    if (process.platform === 'win32') {
      output = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
    } else if (process.platform === 'darwin') {
      output = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
    } else {
      try {
        output = execSync('cat /etc/machine-id', { encoding: 'utf8' });
      } catch (e) {
        output = execSync('cat /var/lib/dbus/machine-id', { encoding: 'utf8' });
      }
    }
    
    // Hash the output to create an 8-character ID (AG-XXXX-XXXX)
    const hash = crypto.createHash('sha256').update(output.trim()).digest('hex').toUpperCase();
    return `AG-${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
  } catch (error) {
    console.error('Failed to generate machine ID:', error);
    return 'AG-0000-0000';
  }
}

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
}

function decrypt(text) {
  try {
    // If it's our previous custom hex format with a colon
    if (text.includes(':')) {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const key = deriveKey(MASTER_SECRET);
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    }

    // Try standard CryptoJS (OpenSSL) Base64 format
    const data = Buffer.from(text, 'base64');
    if (data.toString('utf8', 0, 8) !== 'Salted__') {
      throw new Error('Invalid CryptoJS format');
    }
    const salt = data.subarray(8, 16);
    const ciphertext = data.subarray(16);

    // EVP_BytesToKey equivalent for MD5 (CryptoJS default)
    let keyAndIv = Buffer.alloc(0);
    let previousHash = Buffer.alloc(0);
    while (keyAndIv.length < 48) { // 32 (key) + 16 (IV)
      previousHash = crypto.createHash('md5').update(Buffer.concat([previousHash, Buffer.from(MASTER_SECRET, 'utf8'), salt])).digest();
      keyAndIv = Buffer.concat([keyAndIv, previousHash]);
    }

    const key = keyAndIv.subarray(0, 32);
    const iv = keyAndIv.subarray(32, 48);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('DECRYPTION_FAILED');
  }
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(MASTER_SECRET);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function verifyLicense() {
  const userDataPath = (app && typeof app.getPath === 'function') ? app.getPath('userData') : process.cwd();
  const licensePath = path.join(userDataPath, 'alpha_gym.lic');
  
  if (!fs.existsSync(licensePath)) {
    return { isLicensed: false, reason: 'NO_LICENSE_FILE' };
  }

  try {
    const encryptedPayload = fs.readFileSync(licensePath, 'utf8').trim();
    const decryptedStr = decrypt(encryptedPayload);
    const payload = JSON.parse(decryptedStr);

    const currentMachineId = getMachineId();
    if (payload.machineId !== currentMachineId) {
      return { isLicensed: false, reason: 'MACHINE_MISMATCH' };
    }

    const today = new Date().toISOString().split('T')[0];
    if (today > payload.expiryDate) {
      return { isLicensed: false, reason: 'EXPIRED', clientName: payload.clientName };
    }

    return { 
      isLicensed: true, 
      clientName: payload.clientName, 
      expiryDate: payload.expiryDate 
    };
  } catch (err) {
    return { isLicensed: false, reason: 'DECRYPTION_FAILED' };
  }
}

module.exports = {
  getMachineId,
  verifyLicense,
  decrypt,
  encrypt
};
