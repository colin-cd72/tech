import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';

function EquipmentDetail() {
  const { id } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEquipment();
  }, [id]);

  const loadEquipment = async () => {
    try {
      const response = await api.get(`/equipment/${id}`);
      setEquipment(response.data.equipment);
      setAssignments(response.data.upcomingAssignments);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Equipment not found</p>
        <Link to="/equipment" className="text-blue-600 hover:underline">Back to Equipment</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/equipment" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <Package size={24} />
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-gray-900">{equipment.name}</h1>
            <p className="text-gray-500">{equipment.category_name || 'Uncategorized'}</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Equipment Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {equipment.serial_number && (
            <div>
              <p className="text-sm text-gray-500">Serial Number</p>
              <p className="font-medium">{equipment.serial_number}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Daily Rate</p>
            <p className="font-medium">${parseFloat(equipment.daily_rate || 0).toFixed(2)}</p>
          </div>
          {equipment.replacement_cost && (
            <div>
              <p className="text-sm text-gray-500">Replacement Cost</p>
              <p className="font-medium">${parseFloat(equipment.replacement_cost).toFixed(2)}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Quantity Available</p>
            <p className="font-medium">{equipment.quantity_available}</p>
          </div>
          {equipment.location && (
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="font-medium">{equipment.location}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              equipment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {equipment.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        {equipment.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Description</p>
            <p className="mt-1">{equipment.description}</p>
          </div>
        )}
      </div>

      {/* Upcoming Assignments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Upcoming Assignments</h2>
        </div>

        {assignments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No upcoming assignments
          </div>
        ) : (
          <div className="divide-y">
            {assignments.map((assignment) => (
              <Link
                key={assignment.id}
                to={`/events/${assignment.event_id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{assignment.event_name}</h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Calendar size={14} className="mr-1" />
                        {format(new Date(assignment.event_date), 'MMM d, yyyy')}
                      </span>
                      {assignment.location && (
                        <span className="flex items-center">
                          <MapPin size={14} className="mr-1" />
                          {assignment.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Qty: {assignment.quantity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EquipmentDetail;
