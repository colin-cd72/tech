import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import api from '../../services/api';

function Positions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      const response = await api.get('/positions?is_active=all');
      setPositions(response.data.positions);
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (position) => {
    if (!confirm(`Delete position "${position.name}"?`)) return;

    try {
      await api.delete(`/positions/${position.id}`);
      loadPositions();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete position');
    }
  };

  const handleEdit = (position) => {
    setEditingPosition(position);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Positions</h1>
        <button
          onClick={() => {
            setEditingPosition(null);
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Add Position
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : positions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No positions defined yet
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {positions.map((position) => (
                <tr key={position.id}>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <GripVertical size={16} className="inline mr-2" />
                    {position.sort_order}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {position.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {position.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {position.default_rate ? `$${parseFloat(position.default_rate).toFixed(2)}/hr` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      position.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {position.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(position)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(position)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Position Modal */}
      {showModal && (
        <PositionModal
          position={editingPosition}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadPositions();
          }}
        />
      )}
    </div>
  );
}

function PositionModal({ position, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: position?.name || '',
    description: position?.description || '',
    default_rate: position?.default_rate || '',
    sort_order: position?.sort_order || 0,
    is_active: position?.is_active ?? true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (position) {
        await api.put(`/positions/${position.id}`, form);
      } else {
        await api.post('/positions', form);
      }
      onSaved();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save position');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {position ? 'Edit Position' : 'Add Position'}
          </h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Rate</label>
              <input
                type="number"
                step="0.01"
                value={form.default_rate}
                onChange={(e) => setForm({ ...form, default_rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="$/hr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {position && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Active
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Positions;
