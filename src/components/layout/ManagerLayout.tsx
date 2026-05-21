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
  MapPin,
  Euro,
  FileText,
  Settings,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  tooltip: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

function NavButton({ item, isActive, onClick }: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group/nav">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'text-gray-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>

      {/* Tooltip */}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
        <div className="bg-slate-700 border border-white/10 text-white text-xs px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap max-w-[220px]">
          {/* Arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
          {item.tooltip}
        </div>
      </div>
    </div>
  );
}

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

  const isSuperAdmin = profile?.role === 'superadmin';
  const isCompany = profile?.role === 'company';

  const navGroups: NavGroup[] = [
    {
      heading: 'Operativo',
      items: [
        {
          icon: MapIcon,
          label: 'Rutas Activas',
          path: '/manager/map',
          tooltip: 'Flota en tiempo real — quién, dónde y cuánto llevan',
        },
        {
          icon: LayoutDashboard,
          label: 'Resumen Mensual',
          path: '/manager/dashboard',
          tooltip: 'KPIs del mes, top conductores y centros más activos',
        },
      ],
    },
    {
      heading: 'Gestión',
      items: [
        {
          icon: Users,
          label: isCompany ? 'Mis Conductores' : 'Conductores',
          path: '/manager/drivers',
          tooltip: isCompany
            ? 'Directorio y perfiles de tus conductores'
            : 'Directorio de conductores y empresas',
        },
        {
          icon: Calendar,
          label: 'Calendario',
          path: '/manager/calendar',
          tooltip: 'Festivos nacionales, jornadas y días personalizados',
        },
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            heading: 'Facturación',
            items: [
              {
                icon: FileText,
                label: 'Facturas',
                path: '/manager/invoices',
                tooltip: 'Generar y revisar facturas por centro logístico',
              },
              {
                icon: FileSpreadsheet,
                label: 'Reportes Excel',
                path: '/manager/excel',
                tooltip: 'Exportar rutas y datos operativos a Excel',
              },
            ],
          },
          {
            heading: 'Configuración',
            items: [
              {
                icon: MapPin,
                label: 'Centros Logísticos',
                path: '/manager/locations',
                tooltip: 'Centros, horarios de cierre, precios y tarifas',
              },
              {
                icon: Settings,
                label: 'Ajustes',
                path: '/manager/settings',
                tooltip: 'Herramientas de administración y gestión de datos',
              },
            ],
          },
        ]
      : []),
    ...(isCompany
      ? [
          {
            heading: 'Financiero',
            items: [
              {
                icon: Euro,
                label: 'Mis Ganancias',
                path: '/manager/payouts',
                tooltip: 'Liquidaciones y pagos pendientes de tu empresa',
              },
              {
                icon: FileSpreadsheet,
                label: 'Reportes Excel',
                path: '/manager/excel',
                tooltip: 'Exportar rutas y datos operativos a Excel',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-gray-800 flex flex-col glass fixed h-full z-20">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
              <span className="font-black text-sm">BTS</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm leading-tight truncate">Logistics Pro</h1>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">
                {isSuperAdmin ? 'Super Admin' : isCompany ? 'Empresa' : 'Operaciones'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navGroups.map(group => (
            <div key={group.heading}>
              <p className="px-3 pt-4 pb-1.5 text-[9px] font-black text-white/20 uppercase tracking-[0.15em] select-none">
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavButton
                    key={item.path}
                    item={item}
                    isActive={
                      location.pathname === item.path ||
                      location.pathname.startsWith(item.path + '/')
                    }
                    onClick={() => navigate(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: user + logout */}
        <div className="p-3 border-t border-white/5 space-y-0.5">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/40 mb-1">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
              {profile?.firstName?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">
                {profile?.firstName} {profile?.lastName}
              </p>
              <p className="text-[9px] text-gray-500 truncate">{profile?.email || ''}</p>
            </div>
          </div>

          <div className="relative group/nav">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150">
              <div className="bg-slate-700 border border-white/10 text-white text-xs px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap">
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
                Cerrar sesión y volver al login
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 glass sticky top-0 z-10 px-8 flex items-center justify-between border-b border-gray-800">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar conductor, ruta o incidencia..."
              className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0f172a]" />
            </button>
          </div>
        </header>

        <main className="p-8 flex-1 animate-fade-in bg-slate-900/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
