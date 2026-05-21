import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Truck, BarChart3, AlertTriangle, LogOut, User } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

export default function DriverLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, setUser, setProfile } = useAuthStore();

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const navItems = [
    { icon: Truck, label: 'Reparto', path: '/driver/start' },
    { icon: BarChart3, label: 'Stats', path: '/driver/stats' },
    { icon: User, label: 'Perfil', path: '/driver/profile' },
    { icon: AlertTriangle, label: 'SOS', path: '/driver/emergency', color: 'text-red-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-24">
      <header className="glass p-4 sticky top-0 z-10 flex items-center justify-between">
        <button
          onClick={() => navigate('/driver/profile')}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Conductor</p>
            <h2 className="font-bold text-sm leading-tight">
              {profile?.firstName} {profile?.lastName}
            </h2>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="p-4 animate-fade-in">
        <Outlet />
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass rounded-2xl p-2 flex justify-around items-center shadow-2xl shadow-blue-900/20 z-50">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/driver/start' && location.pathname === '/driver/end');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                isActive ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-gray-400'
              }`}
            >
              <item.icon className={`w-6 h-6 ${item.color && !isActive ? item.color : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
