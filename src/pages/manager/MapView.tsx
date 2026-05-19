import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Truck, Clock, MapPin, ChevronRight, Loader2, Navigation, Search, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import RouteInspector from '../../components/manager/RouteInspector';

const MapView = () => {
  const { user, profile } = useAuthStore();
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ 
    key: 'endTime', 
    direction: 'desc' 
  });
  
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !profile) return;

    // Fetch users for name mapping
    const fetchUsers = async () => {
      let qUsers;
      if (profile.role === 'company') {
        qUsers = query(collection(db, 'users'), where('companyId', '==', user.uid));
      } else {
        qUsers = query(collection(db, 'users'));
      }
      const snapshot = await getDocs(qUsers);
      const userMap: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        userMap[doc.id] = data.name || data.displayName || 'Conductor';
      });
      setUsers(userMap);
    };
    fetchUsers();

    // Fetch routes
    let qRoutes;
    if (profile.role === 'company') {
      qRoutes = query(
        collection(db, 'routes'), 
        where('companyId', '==', user.uid),
        orderBy('startTime', 'desc'), 
        limit(100)
      );
    } else {
      qRoutes = query(
        collection(db, 'routes'), 
        orderBy('startTime', 'desc'), 
        limit(100)
      );
    }
    
    const unsubscribe = onSnapshot(qRoutes, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, profile]);

  const getMs = (val: any) => {
    if (!val) return 0;
    if (val.toDate) return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Split routes
  const activeRoutes = useMemo(() => 
    routes.filter(r => r.startTime && !r.endTime && (!r.endLocation || !r.endLocation.name)), 
    [routes]
  );

  const completedRoutes = useMemo(() => {
    let filtered = routes.filter(r => r.endTime || (r.endLocation && r.endLocation.name));
    
    // Search filter
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const name = (r.driverName || users[r.driverId] || '').toLowerCase();
        return name.includes(lowSearch) ||
               r.startLocation?.name?.toLowerCase().includes(lowSearch) ||
               r.endLocation?.name?.toLowerCase().includes(lowSearch);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'startTime':
          aVal = getMs(a.startTime);
          bVal = getMs(b.startTime);
          break;
        case 'endTime':
          aVal = getMs(a.endTime);
          bVal = getMs(b.endTime);
          break;
        case 'km':
          aVal = (Number(a.endKm) || 0) - (Number(a.startKm) || 0);
          bVal = (Number(b.endKm) || 0) - (Number(b.startKm) || 0);
          break;
        case 'driver':
          aVal = a.driverName || users[a.driverId] || '';
          bVal = b.driverName || users[b.driverId] || '';
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [routes, searchTerm, sortConfig, users]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-400" /> 
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-400" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-gray-400 italic">Cargando flota...</p>
      </div>
    );
  }

  const RouteRow = ({ route, type }: { route: any, type: 'active' | 'completed' }) => {
    const isActive = type === 'active';
    const startMs = getMs(route.startTime);
    const endMs = getMs(route.endTime);
    const driverName = route.driverName || users[route.driverId] || 'Conductor';

    return (
      <tr 
        key={route.id} 
        onClick={() => setSelectedRoute(route)}
        className="hover:bg-white/[0.04] cursor-pointer transition-colors group"
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-xs">
              {driverName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                {driverName}
                {route.hasHelper && (
                  <span className="bg-emerald-500/10 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">
                    +Ayudante
                  </span>
                )}
              </p>
              <p className="text-[10px] text-white/40">ID: {route.driverId?.slice(0, 5)}...</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm text-white/80 font-medium">
              {startMs ? format(new Date(startMs), 'HH:mm', { locale: es }) : '--:--'}
            </span>
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-blue-500/60" />
              {route.startCenter || 'Origen'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm text-white/80 font-medium">
              {isActive ? 'En tránsito...' : (endMs ? format(new Date(endMs), 'HH:mm', { locale: es }) : '--:--')}
            </span>
            <span className={`text-[10px] flex items-center gap-1 ${isActive && route.endCenter ? 'text-blue-400' : 'text-white/40'}`}>
              <MapPin className="w-2.5 h-2.5 text-emerald-500/60" />
              {isActive ? (route.endCenter || '—') : (route.endLocation?.name || route.endCenter || 'Destino')}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">
          {isActive ? (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-emerald-400">INICIADO HACE</span>
              <span className="text-sm text-white/90">
                {startMs ? formatDistanceToNow(new Date(startMs), { locale: es }) : 'N/A'}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-white/80">
              {`${((Number(route.endKm) || 0) - (Number(route.startKm) || 0)).toFixed(1)} KM`}
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-white transition-colors ml-auto" />
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <Helmet>
        <title>BTS Logistics Pro - Mapa de Flota</title>
      </Helmet>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Centro de Mando de Flota</h1>
          <p className="text-blue-200/40 text-sm mt-1">Gestión avanzada de rutas y logística operativa</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text"
              placeholder="Buscar conductor o destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none w-full md:w-80 transition-all focus:bg-white/10"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid / Command Center Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col justify-between h-32 hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl">
              <Truck className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">En Ruta</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white leading-none">{activeRoutes.length}</h3>
            <p className="text-[10px] text-white/40 mt-2">Conductores activos ahora</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col justify-between h-32 hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Con Ayudante</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white leading-none">
              {activeRoutes.filter(r => r.hasHelper).length}
            </h3>
            <p className="text-[10px] text-white/40 mt-2">Rutas asistidas activas</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col justify-between h-32 hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-purple-500/10 rounded-2xl">
              <Navigation className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">KM Totales</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white leading-none">
              {completedRoutes.reduce((acc, r) => acc + (Number(r.endKm) - Number(r.startKm) || 0), 0).toFixed(0)}
            </h3>
            <p className="text-[10px] text-white/40 mt-2">Kms registrados hoy</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col justify-between h-32 hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-orange-500/10 rounded-2xl">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest">Promedio</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white leading-none">
              {completedRoutes.length > 0 
                ? (completedRoutes.reduce((acc, r) => acc + (Number(r.endKm) - Number(r.startKm) || 0), 0) / completedRoutes.length).toFixed(1)
                : '0.0'}
            </h3>
            <p className="text-[10px] text-white/40 mt-2">KM por ruta terminada</p>
          </div>
        </div>
      </div>

      {/* Active Routes Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Rutas Activas ({activeRoutes.length})
          </h2>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Conductor</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Salida</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Ubicación</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">Estado de Tiempo</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeRoutes.map(route => <RouteRow key={route.id} route={route} type="active" />)}
                {activeRoutes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-white/20 italic text-sm">No hay conductores en ruta en este momento</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Completed Routes Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            Historial de Rutas ({completedRoutes.length})
          </h2>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th 
                    onClick={() => requestSort('driver')}
                    className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center">Conductor <SortIcon column="driver" /></div>
                  </th>
                  <th 
                    onClick={() => requestSort('startTime')}
                    className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center">Inicio <SortIcon column="startTime" /></div>
                  </th>
                  <th 
                    onClick={() => requestSort('endTime')}
                    className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center">Fin <SortIcon column="endTime" /></div>
                  </th>
                  <th 
                    onClick={() => requestSort('km')}
                    className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center">Distancia <SortIcon column="km" /></div>
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {completedRoutes.map(route => <RouteRow key={route.id} route={route} type="completed" />)}
                {completedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-white/20 italic">
                      No se encontraron rutas con los filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedRoute && (
        <RouteInspector
          route={selectedRoute}
          users={users}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
};

export default MapView;
