import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventList from './pages/Events/EventList';
import EventDetail from './pages/Events/EventDetail';
import CrewList from './pages/Crew/CrewList';
import CrewDetail from './pages/Crew/CrewDetail';
import EquipmentList from './pages/Equipment/EquipmentList';
import EquipmentDetail from './pages/Equipment/EquipmentDetail';
import Reports from './pages/Reports/Reports';
import Users from './pages/Admin/Users';
import Positions from './pages/Admin/Positions';
import Settings from './pages/Admin/Settings';

function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="events" element={<EventList />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="crew" element={<CrewList />} />
        <Route path="crew/:id" element={<CrewDetail />} />
        <Route path="equipment" element={<EquipmentList />} />
        <Route path="equipment/:id" element={<EquipmentDetail />} />
        <Route path="reports" element={<Reports />} />

        {/* Admin routes */}
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/positions"
          element={
            <ProtectedRoute roles={['admin']}>
              <Positions />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
