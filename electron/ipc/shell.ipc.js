const { ipcMain, shell } = require('electron');

const ALLOWED_PREFIXES = [
  'https://wa.me/',
  'https://web.whatsapp.com/',
];

ipcMain.handle('shell:openExternal', async (_event, url) => {
  if (typeof url === 'string' && ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});
