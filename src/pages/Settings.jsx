import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Plus, Edit2, Power, X, Database, Download, Upload, FileSpreadsheet, ShieldAlert, CheckCircle2, AlertTriangle, Users, Shield, Trash2, Eye, EyeOff } from 'lucide-react';

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

  // Backup & Restore states
  const [backupMsg, setBackupMsg] = useState({ type: '', text: '' });
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // Staff management states
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', username: '', password: '' });
  const [staffFormError, setStaffFormError] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffMsg, setStaffMsg] = useState({ type: '', text: '' });

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
  }, [activeTab]);

  const handleToggle = async (id) => {
    if (!isOwner) return;
    const result = await window.electronAPI.packages.toggleActive({ id });
    if (result.success) {
      fetchPackages();
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
      </div>

      {!isOwner && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-4 text-amber-400 text-sm flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>You are logged in as a <strong>Coach</strong>. Settings modifications, backups, and CSV exports are strictly restricted to Owners.</span>
        </div>
      )}

      {/* Tab Content: Package Management */}
      {activeTab === 'packages' && (
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
                      <td className="px-6 py-4 text-slate-300">{pkg.default_price.toFixed(2)} EGP</td>
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
                        <td className="px-6 py-4 text-right space-x-3">
                          <button
                            onClick={() => openModal(pkg)}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Edit Package"
                          >
                            <Edit2 className="w-5 h-5 inline" />
                          </button>
                          <button
                            onClick={() => handleToggle(pkg.id)}
                            className={`${pkg.is_active === 1 ? 'text-brand-danger hover:text-red-400' : 'text-brand-success hover:text-green-400'} transition-colors`}
                            title={pkg.is_active === 1 ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-5 h-5 inline" />
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
                        <td className="px-6 py-4 text-slate-400 text-sm">{acc.created_at ? acc.created_at.split(' ')[0] : '—'}</td>
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
    </div>
  );
};

export default Settings;
