import { useState } from 'react';
import { FileText, Download, DollarSign, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';

function Reports() {
  const [activeTab, setActiveTab] = useState('costs');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [costReport, setCostReport] = useState(null);
  const [crewSchedule, setCrewSchedule] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadCostReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await api.get(`/reports/costs?${params.toString()}`);
      setCostReport(response.data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCrewSchedule = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await api.get(`/reports/crew-schedule?${params.toString()}`);
      setCrewSchedule(response.data);
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    window.open(`/api/reports/export/excel/costs?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('costs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'costs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign size={18} className="inline mr-2" />
              Cost Report
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={18} className="inline mr-2" />
              Crew Schedule
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Date Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={activeTab === 'costs' ? loadCostReport : loadCrewSchedule}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
            {activeTab === 'costs' && costReport && (
              <div className="flex items-end">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download size={18} className="mr-2" />
                  Export Excel
                </button>
              </div>
            )}
          </div>

          {/* Cost Report */}
          {activeTab === 'costs' && costReport && (
            <div className="space-y-6">
              {/* Grand Total */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-blue-600">Total Crew</p>
                  <p className="text-2xl font-bold text-blue-700">
                    ${costReport.grandTotal.crew.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <p className="text-sm text-orange-600">Total Equipment</p>
                  <p className="text-2xl font-bold text-orange-700">
                    ${costReport.grandTotal.equipment.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-green-600">Grand Total</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${costReport.grandTotal.total.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* By Cost Center */}
              {Object.entries(costReport.byCostCenter).map(([costCenter, data]) => (
                <div key={costCenter} className="border rounded-lg">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold">{costCenter}</h3>
                    <span className="font-bold text-green-700">
                      ${data.totals.total.toFixed(2)}
                    </span>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Event</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Crew</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Equipment</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.events.map((event) => (
                        <tr key={event.id}>
                          <td className="px-4 py-2 text-sm">{event.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {format(new Date(event.event_date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-2 text-sm text-right">${event.crew_cost.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">${event.equipment_cost.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">${event.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Crew Schedule */}
          {activeTab === 'schedule' && crewSchedule && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {crewSchedule.totalAssignments} total assignments
              </p>

              {crewSchedule.schedule.map((crew) => (
                <div key={crew.id} className="border rounded-lg">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{crew.name}</h3>
                      {crew.email && <p className="text-sm text-gray-500">{crew.email}</p>}
                    </div>
                    <span className="text-sm text-gray-500">
                      {crew.assignments.length} assignments
                    </span>
                  </div>
                  <div className="divide-y">
                    {crew.assignments.map((assignment, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{assignment.event_name}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(assignment.event_date), 'EEE, MMM d, yyyy')}
                            {assignment.location && ` • ${assignment.location}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{assignment.position || '-'}</p>
                          {assignment.call_time && (
                            <p className="text-sm text-gray-500">Call: {assignment.call_time}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!costReport && !crewSchedule && (
            <div className="text-center py-12 text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Select date range and click "Generate Report" to view data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
