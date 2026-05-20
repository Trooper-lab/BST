import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Map as MapIcon, 
  Calendar, 
  FileSpreadsheet, 
  Bell, 
  LogOut, 
  Search,
  Settings,
  MapPin,
  Euro,
  FileText
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, setUser, setProfile } = useAuthStore();

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Command Center', path: '/manager/dashboard' },
    { icon: Users, label: profile?.role === 'company' ? 'Mis Conductores' : 'Usuarios y Empresas', path: '/manager/drivers' },
    { icon: MapIcon, label: 'Rutas Activas', path: '/manager/map' },
    { icon: Calendar, label: 'Calendario', path: '/manager/calendar' },
    { icon: FileSpreadsheet, label: 'Reportes Excel', path: '/manager/excel' },
  ];

  if (profile?.role === 'superadmin') {
    menuItems.push({ icon: MapPin, label: 'Centros Logísticos', path: '/manager/locations' });
    menuItems.push({ icon: FileText, label: 'Facturación', path: '/manager/invoices' });
  }

  if (profile?.role === 'company' || profile?.role === 'autonomo') {
    menuItems.push({ icon: Euro, label: 'Mis Ganancias', path: '/manager/payouts' });
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 flex flex-col glass fixed h-full z-20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="font-bold">BTS</span>
            </div>
            <div>
              <h1 className="font-bold leading-tight">Control</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Command Center</p>
            </div>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-all">
            <Settings className="w-5 h-5" />
            Configuración
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-20 glass sticky top-0 z-10 px-8 flex items-center justify-between border-b border-gray-800">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar conductor, ruta o incidencia..."
              className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-400 hover:text-white">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0f172a]"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-gray-800">
              <div className="text-right">
                <p className="text-sm font-bold">{profile?.firstName || 'User'}</p>
                <p className="text-[10px] text-gray-500">
                  {profile?.role === 'superadmin' ? 'Super Admin' : 
                   profile?.role === 'company' ? 'Empresa' : 
                   'Operaciones'}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg flex items-center justify-center font-bold">
                {profile?.firstName?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-8 flex-1 animate-fade-in bg-slate-900/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
