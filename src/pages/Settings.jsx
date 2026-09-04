import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Plus, Edit2, Power, X, Database, Download, Upload, FileSpreadsheet, ShieldAlert, CheckCircle2, AlertTriangle, Users, Shield, Trash2, Eye, EyeOff, MessageSquare, Save } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

const Settings = () => {
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab] = useState('packages'); // packages | backup | staff
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Package Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    duration_days: '',
    default_price: '',
    description: ''
  });
  const [formError, setFormError] = useState('');

  // Package Delete & Feedback states
  const [packageMsg, setPackageMsg] = useState({ type: '', text: '' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pkgToDelete, setPkgToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkedRecordsErrorModal, setLinkedRecordsErrorModal] = useState({ isOpen: false, pkg: null, message: '' });

  // Backup & Restore states
  const [backupMsg, setBackupMsg] = useState({ type: '', text: '' });
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isFactoryResetOpen, setIsFactoryResetOpen] = useState(false);
  const [factoryResetPhrase, setFactoryResetPhrase] = useState('');
  const [factoryResetError, setFactoryResetError] = useState('');
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);

  // Staff management states
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', username: '', password: '' });
  const [staffFormError, setStaffFormError] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffMsg, setStaffMsg] = useState({ type: '', text: '' });

  // WhatsApp template states
  const [waTemplates, setWaTemplates] = useState({
    wa_template_birthday: '',
    wa_template_expiring: '',
    wa_template_expired: '',
    wa_template_welcome: '',
  });
  const [waSaving, setWaSaving] = useState(false);
  const [waMsg, setWaMsg] = useState({ type: '', text: '' });

  const fetchPackages = async () => {
    setLoading(true);
    const result = await window.electronAPI.packages.getAll();
    if (result.success) {
      setPackages(result.packages);
    }
    setLoading(false);
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    const res = await window.electronAPI.auth.getUsers();
    if (res.success) setStaffList(res.users);
    setStaffLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (activeTab === 'staff' && isOwner) fetchStaff();
    if (activeTab === 'whatsapp') fetchWaTemplates();
  }, [activeTab]);

  const fetchWaTemplates = async () => {
    const res = await window.electronAPI.settings.getWhatsAppTemplates();
    if (res.success) {
      setWaTemplates({
        wa_template_birthday: res.wa_template_birthday ?? '',
        wa_template_expiring: res.wa_template_expiring ?? '',
        wa_template_expired: res.wa_template_expired ?? '',
        wa_template_welcome: res.wa_template_welcome ?? '',
      });
    }
  };

  const handleSaveWaTemplates = async () => {
    setWaSaving(true);
    setWaMsg({ type: '', text: '' });
    const res = await window.electronAPI.settings.saveWhatsAppTemplates(waTemplates);
    setWaSaving(false);
    if (res.success) {
      setWaMsg({ type: 'success', text: 'WhatsApp templates saved successfully' });
      setTimeout(() => setWaMsg({ type: '', text: '' }), 4000);
    } else {
      setWaMsg({ type: 'error', text: res.error || 'Failed to save templates.' });
    }
  };

  const handleToggle = async (id) => {
    if (!isOwner) return;
    const result = await window.electronAPI.packages.toggleActive({ id });
    if (result.success) {
      fetchPackages();
    }
  };

  const openDeleteModal = (pkg) => {
    setPkgToDelete(pkg);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeletePackage = async () => {
    if (!pkgToDelete || !isOwner) return;
    setDeleteLoading(true);
    try {
      const deleteFn = window.electronAPI?.packages?.deletePackage || window.electronAPI?.packages?.delete;
      const result = await deleteFn(pkgToDelete.id);
      
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);

      if (result && result.success) {
        setPackages((prev) => prev.filter((p) => p.id !== pkgToDelete.id));
        setPackageMsg({ type: 'success', text: `Package "${pkgToDelete.title}" deleted successfully.` });
        setPkgToDelete(null);
      } else if (result && result.error === 'CANNOT_DELETE_ACTIVE_RECORDS') {
        setLinkedRecordsErrorModal({
          isOpen: true,
          pkg: pkgToDelete,
          message: result.message || 'Cannot permanently delete this package because it is linked to existing client subscriptions. Please deactivate it instead.'
        });
        setPackageMsg({
          type: 'error',
          text: result.message || 'Cannot delete package linked to active subscriptions. Please deactivate it instead.'
        });
        setPkgToDelete(null);
      } else {
        setPackageMsg({
          type: 'error',
          text: result?.message || result?.error || 'Failed to delete package.'
        });
        setPkgToDelete(null);
      }
    } catch (err) {
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);
      setPackageMsg({ type: 'error', text: err.message || 'Error occurred while deleting package.' });
      setPkgToDelete(null);
    }
  };

  const openModal = (pkg = null) => {
    setFormError('');
    if (pkg) {
      setEditingPkg(pkg);
      setFormData({
        title: pkg.title,
        duration_days: pkg.duration_days.toString(),
        default_price: pkg.default_price.toString(),
        description: pkg.description || ''
      });
    } else {
      setEditingPkg(null);
      setFormData({ title: '', duration_days: '', default_price: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title || !formData.duration_days || !formData.default_price) {
      setFormError('Title, Duration, and Price are required.');
      return;
    }

    const payload = {
      title: formData.title,
      duration_days: parseInt(formData.duration_days, 10),
      default_price: parseFloat(formData.default_price),
      description: formData.description
    };

    if (isNaN(payload.duration_days) || payload.duration_days <= 0) {
      setFormError('Duration must be a positive number.');
      return;
    }

    if (isNaN(payload.default_price) || payload.default_price < 0) {
      setFormError('Price must be a valid number.');
      return;
    }

    let result;
    if (editingPkg) {
      result = await window.electronAPI.packages.update({ id: editingPkg.id, ...payload });
    } else {
      result = await window.electronAPI.packages.create(payload);
    }

    if (result.error) {
      setFormError(result.error);
    } else {
      setIsModalOpen(false);
      fetchPackages();
    }
  };

  // Backup & Restore Handlers
  const handleCreateBackup = async () => {
    if (!isOwner) return;
    setBackupMsg({ type: '', text: '' });
    const result = await window.electronAPI.backup.create({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      setBackupMsg({ type: 'success', text: `Backup saved to: ${result.filePath}` });
    }
  };

  const handleRestoreBackup = async () => {
    if (!isOwner) return;
    setIsRestoreConfirmOpen(false);
    setBackupMsg({ type: '', text: '' });

    const result = await window.electronAPI.backup.restore({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      setBackupMsg({ type: 'success', text: result.message || 'Database restored successfully!' });
    }
  };

  const handleExportClientsCsv = async () => {
    if (!isOwner) return;
    setBackupMsg({ type: '', text: '' });
    const result = await window.electronAPI.backup.exportClientsCsv({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      setBackupMsg({ type: 'success', text: `Clients CSV exported to: ${result.filePath}` });
    }
  };

  const handleExportFinancialsCsv = async () => {
    if (!isOwner) return;
    setBackupMsg({ type: '', text: '' });
    const result = await window.electronAPI.backup.exportFinancialsCsv({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      setBackupMsg({ type: 'success', text: `Financials CSV exported to: ${result.filePath}` });
    }
  };

  const handleExportJson = async () => {
    if (!isOwner) return;
    setBackupMsg({ type: '', text: '' });
    const result = await window.electronAPI.backup.exportJson({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      setBackupMsg({ type: 'success', text: `JSON exported to: ${result.filePath}` });
    }
  };

  const handleImportJson = async () => {
    if (!isOwner) return;
    if (!window.confirm('Importing JSON will upsert records into the current database. Continue?')) return;
    setBackupMsg({ type: '', text: '' });
    const result = await window.electronAPI.backup.importJson({ userRole: user.role });
    if (result.canceled) return;
    if (result.error) {
      setBackupMsg({ type: 'error', text: result.error });
    } else {
      const c = result.counts || {};
      setBackupMsg({
        type: 'success',
        text: `Import complete — clients:${c.clients || 0}, subscriptions:${c.subscriptions || 0}, payments:${c.payments || 0}`,
      });
      fetchPackages();
    }
  };

  const handleFactoryReset = async () => {
    if (!isOwner) return;
    setFactoryResetError('');
    if (factoryResetPhrase !== 'DELETE ALL DATA') {
      setFactoryResetError('Type DELETE ALL DATA exactly to confirm.');
      return;
    }
    setFactoryResetLoading(true);
    const result = await window.electronAPI.backup.factoryReset({
      userRole: user.role,
      confirmationPhrase: factoryResetPhrase,
    });
    setFactoryResetLoading(false);
    if (result.error) {
      setFactoryResetError(result.error);
      return;
    }
    setIsFactoryResetOpen(false);
    setFactoryResetPhrase('');
    setBackupMsg({ type: 'success', text: result.message || 'Application data reset successfully.' });
    fetchPackages();
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setStaffFormError('');
    if (!staffForm.fullName.trim() || !staffForm.username.trim() || !staffForm.password.trim()) {
      setStaffFormError('All fields are required.');
      return;
    }
    if (staffForm.password.length < 6) {
      setStaffFormError('Password must be at least 6 characters.');
      return;
    }
    const res = await window.electronAPI.auth.createAdmin({
      fullName: staffForm.fullName,
      username: staffForm.username,
      password: staffForm.password,
      requestingRole: user.role,
    });
    if (res.error) {
      setStaffFormError(res.error);
    } else {
      setIsStaffModalOpen(false);
      setStaffForm({ fullName: '', username: '', password: '' });
      setStaffMsg({ type: 'success', text: 'Staff account created successfully.' });
      fetchStaff();
    }
  };

  const handleDeleteStaff = async (id, username) => {
    if (!window.confirm(`Delete staff account "${username}"? This cannot be undone.`)) return;
    const res = await window.electronAPI.auth.deleteUser({ id, requestingRole: user.role });
    if (res.error) {
      setStaffMsg({ type: 'error', text: res.error });
    } else {
      setStaffMsg({ type: 'success', text: 'Account deleted.' });
      fetchStaff();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-wider text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage system configurations, membership packages, and database backups.</p>
        </div>
        {activeTab === 'packages' && isOwner && (
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2.5 bg-brand-accent hover:bg-[#b8e600] text-black rounded-xl transition-colors font-medium shadow"
          >
            <Plus className="w-5 h-5 mr-2" /> Add Package
          </button>
        )}
      </div>

      {/* Tabs Header */}
      <div className="flex space-x-2 bg-brand-panel p-1 rounded border border-[#222B3D] w-fit flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center ${
            activeTab === 'packages'
              ? 'bg-[#181E2A] text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4 mr-2" /> Package Management
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center ${
              activeTab === 'backup'
                ? 'bg-[#181E2A] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4 mr-2" /> Backup & Data Export
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center ${
              activeTab === 'staff'
                ? 'bg-[#181E2A] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mr-2" /> Staff & Accounts
          </button>
        )}
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center ${
            activeTab === 'whatsapp'
              ? 'bg-[#181E2A] text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp Templates
        </button>
      </div>

      {!isOwner && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-4 text-amber-400 text-sm flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>You are logged in as a <strong>Coach</strong>. Settings modifications, backups, and CSV exports are strictly restricted to Owners.</span>
        </div>
      )}

      {/* Tab Content: Package Management */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          {packageMsg.text && (
            <div className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
              packageMsg.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-green-500/10 border-green-500/30 text-green-400'
            }`}>
              <div className="flex items-center">
                {packageMsg.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
                )}
                <span>{packageMsg.text}</span>
              </div>
              <button onClick={() => setPackageMsg({ type: '', text: '' })} className="text-slate-400 hover:text-white ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D] bg-brand-panel">
              <h2 className="text-xl font-semibold text-white">Membership Plans</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading packages...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121721]/50 text-slate-300 text-sm">
                      <th className="px-6 py-4 font-medium">Package Name</th>
                      <th className="px-6 py-4 font-medium">Duration</th>
                      <th className="px-6 py-4 font-medium">Price</th>
                      <th className="px-6 py-4 font-medium">Description</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      {isOwner && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-[#121721]/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{pkg.title}</td>
                        <td className="px-6 py-4 text-slate-300">{pkg.duration_days} days</td>
                        <td className="px-6 py-4 text-slate-300">{Number(pkg.default_price).toFixed(2)} EGP</td>
                        <td className="px-6 py-4 text-slate-400 text-sm max-w-xs truncate">{pkg.description || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            pkg.is_active === 1 
                              ? 'bg-brand-success/10 text-brand-success border-brand-success/20' 
                              : 'bg-brand-danger/10 text-brand-danger border-brand-danger/20'
                          }`}>
                            {pkg.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {isOwner && (
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => openModal(pkg)}
                              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
                              title="Edit Package"
                            >
                              <Edit2 className="w-5 h-5 inline" />
                            </button>
                            <button
                              onClick={() => handleToggle(pkg.id)}
                              className={`${pkg.is_active === 1 ? 'text-brand-danger hover:text-red-400' : 'text-brand-success hover:text-green-400'} p-1.5 rounded-lg transition-colors`}
                              title={pkg.is_active === 1 ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-5 h-5 inline" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(pkg)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                              title="Delete Package"
                            >
                              <Trash2 className="w-5 h-5 inline" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {packages.length === 0 && (
                      <tr>
                        <td colSpan={isOwner ? 6 : 5} className="px-6 py-8 text-center text-slate-400">
                          No packages found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Backup & Data Management */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {backupMsg.text && (
            <div className={`p-4 rounded border text-sm flex items-center ${
              backupMsg.type === 'error' 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-green-500/10 border-green-500/30 text-green-400'
            }`}>
              {backupMsg.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
              )}
              <span>{backupMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Backup */}
            <div className="card p-6 bg-brand-panel border-[#222B3D] space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-brand-accent/10 rounded border border-brand-accent/20">
                  <Download className="w-6 h-6 text-brand-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">Create Database Backup</h3>
                  <p className="text-xs text-slate-400">Safely save a copy of the SQLite database.</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Exports all client profiles, subscription records, payment history, and system settings to a standalone `.db` file.
              </p>
              <button
                onClick={handleCreateBackup}
                disabled={!isOwner}
                className="w-full py-2.5 px-4 bg-brand-accent hover:bg-[#b8e600] disabled:opacity-50 text-white font-semibold rounded shadow transition-colors"
              >
                Create Backup File
              </button>
            </div>

            {/* Restore Backup */}
            <div className="card p-6 bg-brand-panel border-[#222B3D] space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-brand-danger/10 rounded border border-brand-danger/20">
                  <Upload className="w-6 h-6 text-brand-danger" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">Restore Database</h3>
                  <p className="text-xs text-slate-400">Overwrites current database with a backup file.</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Replaces current live data with a previously saved `.db` backup file. Requires confirmation.
              </p>
              <button
                onClick={() => setIsRestoreConfirmOpen(true)}
                disabled={!isOwner}
                className="w-full py-2.5 px-4 bg-brand-danger hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded shadow transition-colors"
              >
                Restore from Backup File
              </button>
            </div>
          </div>

          {/* Data Export Section */}
          <div className="card p-6 bg-brand-panel border-[#222B3D] space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-brand-success/10 rounded border border-brand-success/20">
                <FileSpreadsheet className="w-6 h-6 text-brand-success" />
              </div>
              <div>
                <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">CSV Data Export</h3>
                <p className="text-xs text-slate-400">Export system records for spreadsheet analysis (Excel, Google Sheets).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={handleExportClientsCsv}
                disabled={!isOwner}
                className="py-3 px-4 bg-[#121721] hover:bg-[#181E2A] disabled:opacity-50 text-white font-medium rounded border border-[#222B3D] flex items-center justify-center transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-brand-success" /> Export Clients Roster (.CSV)
              </button>
              <button
                onClick={handleExportFinancialsCsv}
                disabled={!isOwner}
                className="py-3 px-4 bg-[#121721] hover:bg-[#181E2A] disabled:opacity-50 text-white font-medium rounded border border-[#222B3D] flex items-center justify-center transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-brand-success" /> Export Financial Ledger (.CSV)
              </button>
            </div>
          </div>

          {/* JSON Export / Import */}
          <div className="card p-6 bg-brand-panel border-[#222B3D] space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#8B5CF6]/10 rounded border border-[#8B5CF6]/20">
                <Database className="w-6 h-6 text-[#8B5CF6]" />
              </div>
              <div>
                <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">JSON Data Transfer</h3>
                <p className="text-xs text-slate-400">Portable export/import of business records (no password hashes).</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={handleExportJson}
                disabled={!isOwner}
                className="py-3 px-4 bg-[#121721] hover:bg-[#181E2A] disabled:opacity-50 text-white font-medium rounded border border-[#222B3D] flex items-center justify-center transition-colors"
              >
                <Download className="w-4 h-4 mr-2 text-[#8B5CF6]" /> Export Data (JSON)
              </button>
              <button
                onClick={handleImportJson}
                disabled={!isOwner}
                className="py-3 px-4 bg-[#121721] hover:bg-[#181E2A] disabled:opacity-50 text-white font-medium rounded border border-[#222B3D] flex items-center justify-center transition-colors"
              >
                <Upload className="w-4 h-4 mr-2 text-[#8B5CF6]" /> Import Data (JSON)
              </button>
            </div>
          </div>

          {/* Factory Reset — Owner only */}
          {isOwner && (
            <div className="card p-6 bg-brand-panel border border-brand-danger/40 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-brand-danger/10 rounded border border-brand-danger/20">
                  <ShieldAlert className="w-6 h-6 text-brand-danger" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-display uppercase tracking-wider text-brand-danger">Reset All Application Data</h3>
                  <p className="text-xs text-slate-400">Wipes clients, subscriptions, payments, expenses, and staff. Keeps owner account.</p>
                </div>
              </div>
              <button
                onClick={() => { setFactoryResetPhrase(''); setFactoryResetError(''); setIsFactoryResetOpen(true); }}
                className="w-full py-2.5 px-4 bg-brand-danger hover:bg-red-600 text-white font-semibold rounded shadow transition-colors"
              >
                Reset All Data…
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════ Tab Content: Staff & Accounts ════ */}
      {activeTab === 'staff' && isOwner && (
        <div className="space-y-6">
          {staffMsg.text && (
            <div className={`p-4 rounded border text-sm flex items-center ${
              staffMsg.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-green-500/10 border-green-500/30 text-green-400'
            }`}>
              {staffMsg.type === 'error'
                ? <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                : <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />}
              <span>{staffMsg.text}</span>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D] bg-brand-panel flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">Staff Accounts</h2>
                <p className="text-slate-400 text-sm mt-0.5">Manage system login accounts for staff members.</p>
              </div>
              <button
                onClick={() => { setStaffFormError(''); setStaffForm({ fullName: '', username: '', password: '' }); setIsStaffModalOpen(true); }}
                className="flex items-center px-4 py-2.5 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] text-black rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-[#CCFF00]/20"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Staff Account
              </button>
            </div>

            {staffLoading ? (
              <div className="p-8 text-center text-slate-400">Loading accounts…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#121721]/50 text-slate-300 text-sm">
                      <th className="px-6 py-4 font-medium">Full Name</th>
                      <th className="px-6 py-4 font-medium">Username</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Created</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {staffList.map(acc => (
                      <tr key={acc.id} className="hover:bg-[#121721]/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{acc.full_name}</td>
                        <td className="px-6 py-4 text-slate-300 font-mono">{acc.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            acc.role === 'owner'
                              ? 'bg-[#CCFF00] text-black font-black uppercase tracking-wider/10 text-[#CCFF00] border-[#CCFF00]/20'
                              : 'bg-[#181E2A] text-slate-300 border-slate-600'
                          }`}>
                            <Shield className="w-3 h-3" />
                            {acc.role === 'owner' ? 'Owner' : 'Coach'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{acc.created_at ? formatDateDDMMYYYY(acc.created_at) : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          {acc.role !== 'owner' && (
                            <button
                              onClick={() => handleDeleteStaff(acc.id, acc.username)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                              title="Delete Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {acc.role === 'owner' && (
                            <span className="text-slate-600 text-xs italic">Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {staffList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500">No accounts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ Tab Content: WhatsApp Templates ════ */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Toast */}
          {waMsg.text && (
            <div className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
              waMsg.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <div className="flex items-center gap-2">
                {waMsg.type === 'error'
                  ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                <span>{waMsg.text}</span>
              </div>
              <button onClick={() => setWaMsg({ type: '', text: '' })} className="text-slate-400 hover:text-white ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Variables guide panel */}
          <div className="card p-5 bg-brand-panel border-[#222B3D]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-[#25D366]/10 rounded-lg border border-[#25D366]/20 flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white mb-1">Available Dynamic Variables</h3>
                <p className="text-xs text-slate-400 mb-3">
                  These placeholder tags will be dynamically replaced with the member's real details when sending.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { tag: '{name}',    label: 'Client Name' },
                    { tag: '{days}',    label: 'Remaining Days' },
                    { tag: '{package}', label: 'Package Name' },
                  ].map(({ tag, label }) => (
                    <div
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#181E2A] border border-[#222B3D] rounded-lg"
                    >
                      <code className="text-[#25D366] font-mono text-xs font-bold">{tag}</code>
                      <span className="text-slate-400 text-xs">·</span>
                      <span className="text-slate-300 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Template cards */}
          <div className="card bg-brand-panel border-[#222B3D] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D]">
              <h2 className="text-xl font-semibold text-white">WhatsApp Message Templates</h2>
              <p className="text-slate-400 text-sm mt-0.5">Customize the messages sent to members for key events.</p>
            </div>

            <div className="p-6 space-y-6">
              {[
                {
                  key: 'wa_template_birthday',
                  label: 'Birthday Celebration Template',
                  placeholder: 'Enter birthday greetings template...',
                  accent: 'text-pink-400',
                  border: 'focus:border-pink-500',
                },
                {
                  key: 'wa_template_expiring',
                  label: 'Expiring Membership Reminder',
                  placeholder: 'Enter expiring soon reminder template...',
                  accent: 'text-amber-400',
                  border: 'focus:border-amber-500',
                },
                {
                  key: 'wa_template_expired',
                  label: 'Expired Membership Notice',
                  placeholder: 'Enter expired membership notice template...',
                  accent: 'text-red-400',
                  border: 'focus:border-red-500',
                },
                {
                  key: 'wa_template_welcome',
                  label: 'New Member Welcome Template',
                  placeholder: 'Enter new client welcome template...',
                  accent: 'text-[#25D366]',
                  border: 'focus:border-[#25D366]',
                },
              ].map(({ key, label, placeholder, accent, border }) => (
                <div key={key} className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>
                    {label}
                  </label>
                  <textarea
                    rows={4}
                    value={waTemplates[key]}
                    onChange={(e) => setWaTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 bg-[#121721] border border-[#222B3D] rounded-xl text-white text-sm outline-none resize-none transition-colors placeholder:text-slate-600 ${border}`}
                  />
                </div>
              ))}

              <div className="flex justify-end pt-2 border-t border-[#222B3D]">
                <button
                  onClick={handleSaveWaTemplates}
                  disabled={waSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] hover:bg-[#1da854] disabled:opacity-50 text-white font-semibold rounded-xl shadow transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {waSaving ? 'Saving…' : 'Save Templates'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Add/Edit Modal */}
      {isModalOpen && isOwner && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-white">{editingPkg ? 'Edit Package' : 'Add New Package'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {formError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm">
                  {formError}
                </div>
              )}
              
              <form id="packageForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Package Name</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                    placeholder="e.g. 1 Month Standard"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Duration (Days)</label>
                    <input
                      type="number"
                      name="duration_days"
                      value={formData.duration_days}
                      onChange={handleFormChange}
                      min="1"
                      className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Price (EGP)</label>
                    <input
                      type="number"
                      name="default_price"
                      value={formData.default_price}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-accent"
                      placeholder="200"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Description (Optional)</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    rows="3"
                    className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none resize-none"
                    placeholder="Included perks..."
                  ></textarea>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-[#222B3D] bg-[#121721]/50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="packageForm"
                className="px-4 py-2.5 bg-brand-accent hover:bg-[#b8e600] text-black rounded font-medium shadow-md transition-colors"
              >
                {editingPkg ? 'Save Changes' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {isRestoreConfirmOpen && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-brand-surface border border-brand-danger/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-brand-danger/10">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-brand-danger flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" /> Confirm Database Restore
              </h3>
              <button onClick={() => setIsRestoreConfirmOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-200 text-sm leading-relaxed">
                <strong>WARNING:</strong> Restoring a backup will completely overwrite your current database. All data added since the backup was taken will be lost.
              </p>
              <p className="text-slate-400 text-xs">
                Are you sure you wish to select a backup file to restore?
              </p>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setIsRestoreConfirmOpen(false)}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  className="px-4 py-2.5 bg-brand-danger hover:bg-red-600 text-black rounded-xl text-sm font-semibold shadow"
                >
                  Proceed to Restore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal */}
      {isFactoryResetOpen && isOwner && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-brand-surface border border-brand-danger/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-brand-danger/10">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-brand-danger flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2" /> Reset All Data
              </h3>
              <button onClick={() => setIsFactoryResetOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-200 text-sm leading-relaxed">
                This permanently deletes all clients, subscriptions, payments, expenses, alerts, and staff accounts.
                Your owner login and default packages will be kept.
              </p>
              <p className="text-slate-400 text-xs">
                Type <span className="font-mono text-brand-danger font-bold">DELETE ALL DATA</span> to confirm.
              </p>
              {factoryResetError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">{factoryResetError}</div>
              )}
              <input
                type="text"
                value={factoryResetPhrase}
                onChange={(e) => setFactoryResetPhrase(e.target.value)}
                placeholder="DELETE ALL DATA"
                className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-brand-danger font-mono"
              />
              <div className="flex justify-end space-x-3 pt-4 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setIsFactoryResetOpen(false)}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFactoryReset}
                  disabled={factoryResetLoading || factoryResetPhrase !== 'DELETE ALL DATA'}
                  className="px-4 py-2.5 bg-brand-danger hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold shadow"
                >
                  {factoryResetLoading ? 'Resetting…' : 'Wipe All Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isStaffModalOpen && isOwner && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-[#222B3D] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#CCFF00]" /> Add Staff Account
              </h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-slate-400 hover:text-white p-1.5 hover:bg-[#181E2A] rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              {staffFormError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">{staffFormError}</div>
              )}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  value={staffForm.fullName}
                  onChange={e => setStaffForm(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="e.g. Mohamed Ali"
                  className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Username</label>
                <input
                  type="text"
                  value={staffForm.username}
                  onChange={e => setStaffForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. staff01"
                  className="w-full px-4 py-2.5 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={staffForm.password}
                    onChange={e => setStaffForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    className="w-full px-4 py-2.5 pr-12 bg-brand-panel border border-[#222B3D] rounded-xl text-white outline-none focus:border-[#CCFF00] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#222B3D]">
                <button type="button" onClick={() => setIsStaffModalOpen(false)} className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#CCFF00] text-black font-black uppercase tracking-wider hover:bg-[#b8e600] text-black rounded-xl text-sm font-semibold shadow-lg shadow-[#CCFF00]/20 transition-colors">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Package Confirmation Modal */}
      {isDeleteModalOpen && pkgToDelete && isOwner && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-brand-danger/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-brand-danger/10">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-brand-danger flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Delete Package
              </h3>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setPkgToDelete(null); }} 
                className="text-slate-400 hover:text-white p-1.5 hover:bg-[#181E2A] rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-200 text-sm leading-relaxed">
                Are you sure you want to delete this package? This action cannot be undone.
              </p>
              {pkgToDelete && (
                <div className="p-3 bg-[#121721] rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm">{pkgToDelete.title}</div>
                    <div className="text-xs text-slate-400">{pkgToDelete.duration_days} days &bull; {Number(pkgToDelete.default_price).toFixed(2)} EGP</div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${pkgToDelete.is_active === 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {pkgToDelete.is_active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#222B3D]">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => { setIsDeleteModalOpen(false); setPkgToDelete(null); }}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleConfirmDeletePackage}
                  className="px-4 py-2.5 bg-brand-danger hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition-colors flex items-center gap-2"
                >
                  {deleteLoading ? (
                    'Deleting...'
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Confirm Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Linked Records Notice Modal */}
      {linkedRecordsErrorModal.isOpen && (
        <div className="fixed inset-0 bg-[#0B0E14]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#222B3D] flex justify-between items-center bg-amber-500/10">
              <h3 className="text-lg font-black font-display uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Cannot Delete Package
              </h3>
              <button 
                onClick={() => setLinkedRecordsErrorModal({ isOpen: false, pkg: null, message: '' })} 
                className="text-slate-400 hover:text-white p-1.5 hover:bg-[#181E2A] rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-200 text-sm leading-relaxed">
                {linkedRecordsErrorModal.message || 'Cannot permanently delete this package because it is linked to existing client subscriptions. Please deactivate it instead.'}
              </p>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                Tip: Deactivating a package hides it from new subscriptions while preserving historical records for existing members.
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#222B3D]">
                <button
                  type="button"
                  onClick={() => setLinkedRecordsErrorModal({ isOpen: false, pkg: null, message: '' })}
                  className="px-4 py-2.5 bg-[#181E2A] hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
                {linkedRecordsErrorModal.pkg && linkedRecordsErrorModal.pkg.is_active === 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const targetPkg = linkedRecordsErrorModal.pkg;
                      setLinkedRecordsErrorModal({ isOpen: false, pkg: null, message: '' });
                      await handleToggle(targetPkg.id);
                      setPackageMsg({ type: 'success', text: `Package "${targetPkg.title}" has been deactivated.` });
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-sm shadow transition-colors flex items-center gap-1.5"
                  >
                    <Power className="w-4 h-4" /> Deactivate Package
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

