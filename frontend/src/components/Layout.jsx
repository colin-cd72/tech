import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Calendar,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  UserCog,
  Briefcase
} from 'lucide-react';
import useAuthStore from '../store/authStore';

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Crew', href: '/crew', icon: Users },
    { name: 'Equipment', href: '/equipment', icon: Package },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  const adminNavigation = [
    { name: 'Users', href: '/admin/users', icon: UserCog },
    { name: 'Positions', href: '/admin/positions', icon: Briefcase },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">TGL Schedule</h1>
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} className="mr-3" />
              {item.name}
            </Link>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase">
                Admin
              </div>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} className="mr-3" />
                  {item.name}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center h-16 px-4 bg-white border-b">
          <button
            className="text-gray-600 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-lg font-semibold">TGL Schedule</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
