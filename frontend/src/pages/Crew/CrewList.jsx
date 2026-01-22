import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Upload, Users } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

function CrewList() {
  const [crewMembers, setCrewMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadCrew();
  }, [search]);

  const loadCrew = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await api.get(`/crew?${params.toString()}`);
      setCrewMembers(response.data.crewMembers);
    } catch (error) {
      console.error('Failed to load crew:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Crew</h1>
        {isAdmin && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Upload size={20} className="mr-2" />
              Import CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Add Crew
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search crew..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Crew Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : crewMembers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No crew members found
          </div>
        ) : (
          crewMembers.map((crew) => (
            <Link
              key={crew.id}
              to={`/crew/${crew.id}`}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                    {crew.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{crew.name}</h3>
                    {crew.email && (
                      <p className="text-sm text-gray-500">{crew.email}</p>
                    )}
                  </div>
                </div>
                {!crew.is_active && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-1 text-sm">
                {crew.default_position_name && (
                  <p className="text-gray-600">
                    <span className="text-gray-400">Position:</span> {crew.default_position_name}
                  </p>
                )}
                {crew.department && (
                  <p className="text-gray-600">
                    <span className="text-gray-400">Dept:</span> {crew.department}
                  </p>
                )}
                {crew.hourly_rate && (
                  <p className="text-gray-600">
                    <span className="text-gray-400">Rate:</span> ${parseFloat(crew.hourly_rate).toFixed(2)}/hr
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCrewModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadCrew();
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportCrewModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            loadCrew();
          }}
        />
      )}
    </div>
  );
}

function CreateCrewModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    hourly_rate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/crew', form);
      onCreated();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create crew member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Crew Member</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportCrewModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/crew/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Import Crew from CSV</h2>
        </div>

        <div className="p-6 space-y-4">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a CSV or Excel file with columns: Name, Email, Phone, Department, Hourly Rate
              </p>

              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {result.error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {result.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-700">{result.message}</p>
                  {result.results?.errors?.length > 0 && (
                    <div className="text-sm text-red-600">
                      <p className="font-medium">Errors:</p>
                      {result.results.errors.slice(0, 5).map((err, i) => (
                        <p key={i}>Row {err.row}: {err.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={result.error ? () => setResult(null) : onImported}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {result.error ? 'Try Again' : 'Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CrewList;
