const { contextBridge, ipcRenderer, webUtils } = require('electron');

// ============================================================
// Alpha Gym — Preload Script
// ============================================================
contextBridge.exposeInMainWorld('electronAPI', {
  // Shell — open whitelisted external URLs (wa.me, web.whatsapp.com)
  openExternalUrl: (url) => ipcRenderer.invoke('shell:openExternal', url),

  getPathForFile: (file) => {
    try {
      return webUtils && typeof webUtils.getPathForFile === 'function'
        ? webUtils.getPathForFile(file)
        : (file.path || '');
    } catch (e) {
      return file.path || '';
    }
  },
  auth: {
    checkOwnerExists: (args) => ipcRenderer.invoke('auth:checkOwnerExists', args),
    setupOwner: (args) => ipcRenderer.invoke('auth:setupOwner', args),
    login: (args) => ipcRenderer.invoke('auth:login', args),
    verifyPin: (args) => ipcRenderer.invoke('auth:verifyPin', args),
    verifyCredentialsPin: (args) => ipcRenderer.invoke('auth:verifyCredentialsPin', args),
    resetPassword: (args) => ipcRenderer.invoke('auth:resetPassword', args),
    getUsers: (args) => ipcRenderer.invoke('auth:getUsers', args),
    createAdmin: (args) => ipcRenderer.invoke('auth:createAdmin', args),
    deleteUser: (args) => ipcRenderer.invoke('auth:deleteUser', args),
  },
  packages: {
    getAll: (args) => ipcRenderer.invoke('packages:getAll', args),
    getById: (args) => ipcRenderer.invoke('packages:getById', args),
    create: (args) => ipcRenderer.invoke('packages:create', args),
    update: (args) => ipcRenderer.invoke('packages:update', args),
    toggleActive: (args) => ipcRenderer.invoke('packages:toggleActive', args),
    deletePackage: (id) => ipcRenderer.invoke('packages:delete', id),
    delete: (id) => ipcRenderer.invoke('packages:delete', id),
  },
  clients: {
    getAll: (args) => ipcRenderer.invoke('clients:getAll', args),
    getStats: (args) => ipcRenderer.invoke('clients:getStats', args),
    getById: (args) => ipcRenderer.invoke('clients:getById', args),
    getPayments: (args) => ipcRenderer.invoke('clients:getPayments', args),
    create: (args) => ipcRenderer.invoke('clients:create', args),
    update: (args) => ipcRenderer.invoke('clients:update', args),
    delete: (args) => ipcRenderer.invoke('clients:delete', args),
    uploadPhoto: (args) => ipcRenderer.invoke('clients:uploadPhoto', args),
    removePhoto: (args) => ipcRenderer.invoke('clients:removePhoto', args),
    deletePhoto: (clientId) => ipcRenderer.invoke('clients:deletePhoto', clientId),
    getTodayBirthdays: () => ipcRenderer.invoke('clients:getTodayBirthdays'),
  },
  subscriptions: {
    create: (args) => ipcRenderer.invoke('subscriptions:create', args),
    renew: (args) => ipcRenderer.invoke('subscriptions:renew', args),
    freeze: (args) => ipcRenderer.invoke('subscriptions:freeze', args),
    unfreeze: (args) => ipcRenderer.invoke('subscriptions:unfreeze', args),
    checkIn: (args) => ipcRenderer.invoke('subscriptions:checkIn', args),
    getHistory: (args) => ipcRenderer.invoke('subscriptions:getHistory', args),
  },
  payments: {
    getAll: (args) => ipcRenderer.invoke('payments:getAll', args),
    getByClient: (args) => ipcRenderer.invoke('payments:getByClient', args),
  },
  bodyProgress: {
    getByClient: (args) => ipcRenderer.invoke('bodyProgress:getByClient', args),
    add: (args) => ipcRenderer.invoke('bodyProgress:add', args),
    delete: (args) => ipcRenderer.invoke('bodyProgress:delete', args),
  },
  expenses: {
    getAll: (args) => ipcRenderer.invoke('expenses:getAll', args),
    create: (args) => ipcRenderer.invoke('expenses:create', args),
    delete: (args) => ipcRenderer.invoke('expenses:delete', args),
  },
  alerts: {
    getExpiringSoon: (args) => ipcRenderer.invoke('alerts:getExpiringSoon', args),
    getExpired: (args) => ipcRenderer.invoke('alerts:getExpired', args),
    getCounts: (args) => ipcRenderer.invoke('alerts:getCounts', args),
    getAll: (args) => ipcRenderer.invoke('alerts:getAll', args),
  },
  notifications: {
    getTodayBirthdays: () => ipcRenderer.invoke('notifications:getTodayBirthdays'),
    getAll: (args) => ipcRenderer.invoke('notifications:getAll', args),
  },
  reports: {
    getSummary: (args) => ipcRenderer.invoke('reports:getSummary', args),
    getDashboardMetrics: (args) => ipcRenderer.invoke('reports:getDashboardMetrics', args),
    getClientDistribution: (args) => ipcRenderer.invoke('reports:getClientDistribution', args),
    getHistoricalMonthlyData: (args) => ipcRenderer.invoke('reports:getHistoricalMonthlyData', args),
  },
  backup: {
    create: (args) => ipcRenderer.invoke('backup:create', args),
    restore: (args) => ipcRenderer.invoke('backup:restore', args),
    exportClientsCsv: (args) => ipcRenderer.invoke('backup:exportClientsCsv', args),
    exportFinancialsCsv: (args) => ipcRenderer.invoke('backup:exportFinancialsCsv', args),
    exportJson: (args) => ipcRenderer.invoke('backup:exportJson', args),
    importJson: (args) => ipcRenderer.invoke('backup:importJson', args),
    factoryReset: (args) => ipcRenderer.invoke('backup:factoryReset', args),
  },
  print: {
    receipt: (args) => ipcRenderer.invoke('print:receipt', args),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onUpdateAvailable: (callback) => {
      const listener = (e, data) => callback(data);
      ipcRenderer.on('update-available', listener);
      return () => ipcRenderer.removeListener('update-available', listener);
    },
    onDownloadProgress: (callback) => {
      const listener = (e, data) => callback(data);
      ipcRenderer.on('download-progress', listener);
      return () => ipcRenderer.removeListener('download-progress', listener);
    },
    onUpdateProgress: (callback) => { // Alias for backward compatibility
      const listener = (e, data) => callback(data);
      ipcRenderer.on('download-progress', listener);
      return () => ipcRenderer.removeListener('download-progress', listener);
    },
    onUpdateDownloaded: (callback) => {
      const listener = (e, data) => callback(data);
      ipcRenderer.on('update-downloaded', listener);
      return () => ipcRenderer.removeListener('update-downloaded', listener);
    },
    onError: (callback) => {
      const listener = (e, data) => callback(data);
      ipcRenderer.on('update-error', listener);
      return () => ipcRenderer.removeListener('update-error', listener);
    },
  },
  settings: {
    getWhatsAppTemplates: () => ipcRenderer.invoke('settings:getWhatsAppTemplates'),
    saveWhatsAppTemplates: (templates) => ipcRenderer.invoke('settings:saveWhatsAppTemplates', templates),
  },
});
