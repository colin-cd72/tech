import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, Package, DollarSign,
  Plus, Trash2, Edit2, Download, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [event, setEvent] = useState(null);
  const [crewAssignments, setCrewAssignments] = useState([]);
  const [equipmentAssignments, setEquipmentAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  const canEdit = ['admin', 'scheduler'].includes(user?.role);

  useEffect(() => {
    loadEvent();
  }, [id]);

  const loadEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      setEvent(response.data.event);
      setCrewAssignments(response.data.crewAssignments);
      setEquipmentAssignments(response.data.equipmentAssignments);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const crewTotal = crewAssignments.reduce((sum, a) => {
      const rate = parseFloat(a.rate) || 0;
      return sum + (rate * 8); // Default 8 hours
    }, 0);

    const equipmentTotal = equipmentAssignments.reduce((sum, a) => {
      const rate = parseFloat(a.rate) || 0;
      const qty = parseInt(a.quantity) || 1;
      return sum + (rate * qty);
    }, 0);

    return { crewTotal, equipmentTotal, total: crewTotal + equipmentTotal };
  };

  const handleDeleteCrewAssignment = async (assignmentId) => {
    if (!confirm('Remove this crew assignment?')) return;
    try {
      await api.delete(`/assignments/crew/${assignmentId}`);
      loadEvent();
    } catch (error) {
      alert('Failed to remove assignment');
    }
  };

  const handleDeleteEquipmentAssignment = async (assignmentId) => {
    if (!confirm('Remove this equipment assignment?')) return;
    try {
      await api.delete(`/assignments/equipment/${assignmentId}`);
      loadEvent();
    } catch (error) {
      alert('Failed to remove assignment');
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/reports/export/pdf/event/${id}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Event not found</p>
        <Link to="/events" className="text-blue-600 hover:underline">
          Back to Events
        </Link>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/events"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center">
                <Calendar size={16} className="mr-1" />
                {format(new Date(event.event_date), 'EEEE, MMMM d, yyyy')}
              </span>
              {event.location && (
                <span className="flex items-center">
                  <MapPin size={16} className="mr-1" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download size={18} className="mr-2" />
            PDF
          </button>
          <span className={`px-3 py-2 rounded-lg text-sm font-medium ${
            event.status === 'confirmed' ? 'bg-green-100 text-green-800' :
            event.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
            event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {event.status}
          </span>
        </div>
      </div>

      {/* Event Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {event.start_time && (
            <div>
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium">
                {event.start_time} - {event.end_time || 'TBD'}
              </p>
            </div>
          )}
          {event.venue && (
            <div>
              <p className="text-sm text-gray-500">Venue</p>
              <p className="font-medium">{event.venue}</p>
            </div>
          )}
          {event.cost_center && (
            <div>
              <p className="text-sm text-gray-500">Cost Center</p>
              <p className="font-medium">{event.cost_center}</p>
            </div>
          )}
          {event.load_in_time && (
            <div>
              <p className="text-sm text-gray-500">Load In</p>
              <p className="font-medium">{event.load_in_time}</p>
            </div>
          )}
        </div>
        {event.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Description</p>
            <p className="mt-1">{event.description}</p>
          </div>
        )}
      </div>

      {/* Cost Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Summary</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Crew</p>
            <p className="text-2xl font-bold text-blue-700">${totals.crewTotal.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-600">Equipment</p>
            <p className="text-2xl font-bold text-orange-700">${totals.equipmentTotal.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Total</p>
            <p className="text-2xl font-bold text-green-700">${totals.total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Crew Assignments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users size={20} className="mr-2" />
            Crew ({crewAssignments.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowAddCrew(true)}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-1" />
              Add Crew
            </button>
          )}
        </div>

        {crewAssignments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No crew assigned yet
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Call Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {crewAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{assignment.crew_name}</p>
                      {assignment.crew_email && (
                        <p className="text-sm text-gray-500">{assignment.crew_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {assignment.position_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {assignment.call_time || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${parseFloat(assignment.rate || 0).toFixed(2)}/hr
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      assignment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {assignment.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteCrewAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Equipment Assignments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package size={20} className="mr-2" />
            Equipment ({equipmentAssignments.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowAddEquipment(true)}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-1" />
              Add Equipment
            </button>
          )}
        </div>

        {equipmentAssignments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No equipment assigned yet
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {equipmentAssignments.map((assignment) => {
                const cost = (parseFloat(assignment.rate) || 0) * (parseInt(assignment.quantity) || 1);
                return (
                  <tr key={assignment.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{assignment.equipment_name}</p>
                      {assignment.serial_number && (
                        <p className="text-sm text-gray-500">{assignment.serial_number}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${parseFloat(assignment.rate || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ${cost.toFixed(2)}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteEquipmentAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Crew Modal */}
      {showAddCrew && (
        <AddCrewModal
          eventId={id}
          onClose={() => setShowAddCrew(false)}
          onAdded={() => {
            setShowAddCrew(false);
            loadEvent();
          }}
        />
      )}

      {/* Add Equipment Modal */}
      {showAddEquipment && (
        <AddEquipmentModal
          eventId={id}
          onClose={() => setShowAddEquipment(false)}
          onAdded={() => {
            setShowAddEquipment(false);
            loadEvent();
          }}
        />
      )}
    </div>
  );
}

function AddCrewModal({ eventId, onClose, onAdded }) {
  const [crewMembers, setCrewMembers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [callTime, setCallTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [crewRes, positionsRes] = await Promise.all([
        api.get('/crew'),
        api.get('/positions')
      ]);
      setCrewMembers(crewRes.data.crewMembers);
      setPositions(positionsRes.data.positions);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/assignments/crew', {
        event_id: eventId,
        crew_member_id: selectedCrew,
        position_id: selectedPosition || null,
        call_time: callTime || null
      });
      onAdded();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add crew');
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Crew Member *
            </label>
            <select
              required
              value={selectedCrew}
              onChange={(e) => setSelectedCrew(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select crew member...</option>
              {crewMembers.map((cm) => (
                <option key={cm.id} value={cm.id}>{cm.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select position...</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call Time
            </label>
            <input
              type="time"
              value={callTime}
              onChange={(e) => setCallTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Crew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddEquipmentModal({ eventId, onClose, onAdded }) {
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const response = await api.get('/equipment');
      setEquipment(response.data.equipment);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/assignments/equipment', {
        event_id: eventId,
        equipment_id: selectedEquipment,
        quantity
      });
      onAdded();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add equipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Equipment</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment *
            </label>
            <select
              required
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} {eq.category_name && `(${eq.category_name})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventDetail;
