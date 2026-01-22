import { useState, useEffect } from 'react';
import { Mail, Cloud, Save, Send, RefreshCw } from 'lucide-react';
import api from '../../services/api';

function Settings() {
  const [activeTab, setActiveTab] = useState('email');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('email')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'email'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail size={18} className="inline mr-2" />
              Email Settings
            </button>
            <button
              onClick={() => setActiveTab('sharepoint')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sharepoint'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Cloud size={18} className="inline mr-2" />
              SharePoint
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'email' && <EmailSettings />}
          {activeTab === 'sharepoint' && <SharePointSettings />}
        </div>
      </div>
    </div>
  );
}

function EmailSettings() {
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    from_name: '',
    enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/email');
      setSettings({
        ...settings,
        ...response.data.settings,
        smtp_pass: '' // Don't show existing password
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/settings/email', settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    setMessage(null);

    try {
      await api.post('/settings/email/test', { test_email: testEmail });
      setMessage({ type: 'success', text: 'Test email sent successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {message && (
        <div className={`px-4 py-3 rounded ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
          <input
            type="text"
            value={settings.smtp_host}
            onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="smtp.example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
          <input
            type="number"
            value={settings.smtp_port}
            onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={settings.smtp_user}
            onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={settings.smtp_pass}
            onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Leave blank to keep current"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
          <input
            type="email"
            value={settings.from_email}
            onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
          <input
            type="text"
            value={settings.from_name}
            onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="TGL Schedule"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.smtp_secure}
            onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Use SSL/TLS</span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Enable Email Notifications</span>
        </label>
      </div>

      <div className="flex items-center space-x-4 pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={18} className="mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <div className="flex items-center space-x-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Test email address"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testEmail}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <Send size={18} className="mr-2" />
            {testing ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>
    </form>
  );
}

function SharePointSettings() {
  const [settings, setSettings] = useState({
    tenant_id: '',
    client_id: '',
    client_secret: '',
    site_url: '',
    list_name: '',
    sync_enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/sharepoint');
      setSettings({
        ...settings,
        ...response.data.settings,
        client_secret: ''
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get('/settings/sharepoint/history');
      setHistory(response.data.history);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/settings/sharepoint', settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await api.post('/settings/sharepoint/sync');
      setMessage({ type: 'success', text: response.data.message });
      loadHistory();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {message && (
          <div className={`px-4 py-3 rounded ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-sm text-yellow-800">
          <p className="font-medium">Azure AD App Registration Required</p>
          <p className="mt-1">
            To sync with SharePoint, you need to create an Azure AD App Registration with Microsoft Graph API permissions.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
            <input
              type="text"
              value={settings.tenant_id}
              onChange={(e) => setSettings({ ...settings, tenant_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={settings.client_id}
              onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
          <input
            type="password"
            value={settings.client_secret}
            onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Leave blank to keep current"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SharePoint Site URL</label>
            <input
              type="text"
              value={settings.site_url}
              onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="yourcompany.sharepoint.com/sites/sitename"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">List Name</label>
            <input
              type="text"
              value={settings.list_name}
              onChange={(e) => setSettings({ ...settings, list_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Schedule"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} className="mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </form>

      {/* Sync History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Sync History</h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Added</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Updated</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.slice(0, 5).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-sm">
                      {new Date(log.synced_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">{log.events_added}</td>
                    <td className="px-4 py-2 text-sm">{log.events_updated}</td>
                    <td className="px-4 py-2 text-sm">{log.synced_by_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
