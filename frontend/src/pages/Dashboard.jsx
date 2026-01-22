import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/settings/dashboard');
      setStats(response.data.stats);
      setUpcomingEvents(response.data.upcomingEvents);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Calendar size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Upcoming Events</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.upcomingEvents || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Clock size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">This Week</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.thisWeekEvents || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Users size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Crew</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.activeCrew || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600">
              <Package size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Equipment</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.activeEquipment || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
          <Link
            to="/events"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            View All <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No upcoming events scheduled
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(event.event_date), 'EEE, MMM d, yyyy')}
                      {event.location && ` • ${event.location}`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Users size={16} className="mr-1" />
                      {event.crew_count}
                    </span>
                    <span className="flex items-center">
                      <Package size={16} className="mr-1" />
                      {event.equipment_count}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      event.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      event.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.status}
                    </span>
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

export default Dashboard;
