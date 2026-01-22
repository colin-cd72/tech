import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';

function CrewDetail() {
  const { id } = useParams();
  const [crewMember, setCrewMember] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCrew();
  }, [id]);

  const loadCrew = async () => {
    try {
      const response = await api.get(`/crew/${id}`);
      setCrewMember(response.data.crewMember);
      setAssignments(response.data.upcomingAssignments);
    } catch (error) {
      console.error('Failed to load crew member:', error);
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

  if (!crewMember) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Crew member not found</p>
        <Link to="/crew" className="text-blue-600 hover:underline">Back to Crew</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/crew" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-medium">
            {crewMember.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-gray-900">{crewMember.name}</h1>
            <p className="text-gray-500">
              {crewMember.default_position_name || 'No default position'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {crewMember.email && (
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{crewMember.email}</p>
            </div>
          )}
          {crewMember.phone && (
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{crewMember.phone}</p>
            </div>
          )}
          {crewMember.department && (
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-medium">{crewMember.department}</p>
            </div>
          )}
          {crewMember.hourly_rate && (
            <div>
              <p className="text-sm text-gray-500">Hourly Rate</p>
              <p className="font-medium">${parseFloat(crewMember.hourly_rate).toFixed(2)}</p>
            </div>
          )}
        </div>
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
                    <p className="text-sm font-medium">{assignment.position_name || '-'}</p>
                    {assignment.call_time && (
                      <p className="text-sm text-gray-500">Call: {assignment.call_time}</p>
                    )}
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

export default CrewDetail;
