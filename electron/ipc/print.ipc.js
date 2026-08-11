const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('../db');

function calcAge(birthDate) {
  if (!birthDate) return '';
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 ? String(age) : '';
}

ipcMain.handle('print:receipt', async (event, data) => {
  try {
    let {
      payment_id = 'N/A',
      client_id,
      client_name,
      client_phone,
      client_age,
      client_weight,
      client_area,
      client_code,
      package_name,
      amount,
      paid_amount,
      start_date,
      end_date,
      payment_date
    } = data || {};

    // Enrich from DB if payment_id is provided
    if (payment_id && payment_id !== 'N/A' && payment_id !== 'RENEWAL') {
      try {
        const payRow = db.prepare(`
          SELECT p.*, s.start_date as sub_start, s.end_date as sub_end, pkg.title as pkg_title,
                 c.id as c_id, c.name as c_name, c.phone as c_phone, c.birth_date as c_dob,
                 c.weight_kg as c_weight, c.area as c_area, c.client_code as c_code
          FROM payments p
          LEFT JOIN subscriptions s ON p.subscription_id = s.id
          LEFT JOIN packages pkg ON s.package_id = pkg.id
          LEFT JOIN clients c ON p.client_id = c.id
          WHERE p.id = ?
        `).get(payment_id);

        if (payRow) {
          if (!client_name && payRow.c_name) client_name = payRow.c_name;
          if (!client_phone && payRow.c_phone) client_phone = payRow.c_phone;
          if (!client_age && payRow.c_dob) client_age = calcAge(payRow.c_dob);
          if (!client_weight && payRow.c_weight) client_weight = payRow.c_weight;
          if (!client_area && payRow.c_area) client_area = payRow.c_area;
          if (!client_code && payRow.c_code) client_code = payRow.c_code;
          if (!package_name && payRow.pkg_title) package_name = payRow.pkg_title;
          if (!amount) amount = payRow.amount;
          if (!paid_amount) paid_amount = payRow.amount;
          if (!start_date && payRow.sub_start) start_date = payRow.sub_start;
          if (!end_date && payRow.sub_end) end_date = payRow.sub_end;
          if (!payment_date && payRow.paid_at) payment_date = payRow.paid_at.split(' ')[0];
        }
      } catch (e) {
        // Fallback to provided data
      }
    }

    if ((!client_phone || !client_age || !client_weight || !client_area) && (client_id || client_code)) {
      try {
        const clientRow = db.prepare('SELECT * FROM clients WHERE id = ? OR client_code = ?').get(client_id || 0, client_code || '');
        if (clientRow) {
          if (!client_name) client_name = clientRow.name;
          if (!client_phone) client_phone = clientRow.phone;
          if (!client_age && clientRow.birth_date) client_age = calcAge(clientRow.birth_date);
          if (!client_weight && clientRow.weight_kg) client_weight = clientRow.weight_kg;
          if (!client_area && clientRow.area) client_area = clientRow.area;
          if (!client_code && clientRow.client_code) client_code = clientRow.client_code;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Default fallbacks
    client_name = client_name || 'Member';
    client_phone = client_phone || '—';
    client_age = client_age !== undefined && client_age !== null && client_age !== '' ? String(client_age) : '—';
    client_weight = client_weight ? (String(client_weight).includes('kg') ? client_weight : `${client_weight} kg`) : '—';
    client_area = client_area || '—';
    client_code = client_code || 'AG-0000';
    package_name = package_name || 'Membership Subscription';
    payment_date = payment_date || new Date().toISOString().split('T')[0];
    start_date = start_date || payment_date;
    end_date = end_date || '—';

    const totalAmount = parseFloat(amount) || parseFloat(paid_amount) || 0;
    const paid = parseFloat(paid_amount) || totalAmount;
    const residual = Math.max(0, totalAmount - paid).toFixed(2);

    // Read logo image and convert to Base64 data URI
    const logoPath = path.join(__dirname, '../../bill/logo.png');
    let logoDataUri = '';
    if (fs.existsSync(logoPath)) {
      const logoBase64 = fs.readFileSync(logoPath).toString('base64');
      logoDataUri = `data:image/png;base64,${logoBase64}`;
    }

    // Read exact master bill.html file from disk
    const templatePath = path.join(__dirname, '../../bill/bill.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace dynamic placeholders inside bill.html
    const replacements = {
      '{{LOGO_BASE64}}':    logoDataUri,
      '{{CLIENT_NAME}}':    client_name,
      '{{CLIENT_PHONE}}':   client_phone,
      '{{CLIENT_AGE}}':     client_age,
      '{{CLIENT_WEIGHT}}':  client_weight,
      '{{CLIENT_AREA}}':    client_area,
      '{{CLIENT_CODE}}':    client_code,
      '{{PACKAGE_NAME}}':   package_name,
      '{{START_DATE}}':     start_date,
      '{{END_DATE}}':       end_date,
      '{{AMOUNT_PAID}}':    `${paid.toFixed(2)}`,
      '{{AMOUNT_RESIDUAL}}': residual,
      '{{PAYMENT_DATE}}':   payment_date,
      '{{TRANSACTION_ID}}': String(payment_id),
    };

    for (const [token, value] of Object.entries(replacements)) {
      const safeVal = value !== undefined && value !== null ? String(value) : '';
      htmlContent = htmlContent.split(token).join(safeVal);
    }

    if (logoDataUri && htmlContent.includes('src="logo.png"')) {
      htmlContent = htmlContent.replace('src="logo.png"', `src="${logoDataUri}"`);
    }

    const tmpFileName = `alpha-gym-receipt-${Date.now()}.html`;
    const tmpPath = path.join(require('electron').app.getPath('temp'), tmpFileName);
    fs.writeFileSync(tmpPath, htmlContent, 'utf-8');

    let printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWin.loadURL(`file://${tmpPath}`);

    // Wait for assets to render cleanly before printing
    await new Promise(resolve => setTimeout(resolve, 600));

    printWin.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
      if (printWin) {
        printWin.close();
        printWin = null;
      }
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch (err) {
        console.error('Failed to delete temp receipt:', err);
      }
    });

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
