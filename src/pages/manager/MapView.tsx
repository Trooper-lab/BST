import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Truck, Clock, MapPin, Loader2, Navigation,
  Users, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RouteInspector from '../../components/manager/RouteInspector';

function getMs(val: any): number {
  if (!val) return 0;
  if (val.toDate) return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function elapsedStr(val: any): string {
  const ms = getMs(val);
  if (!ms) return '—';
  const diff = Math.max(0, Date.now() - ms);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const MapView = () => {
  const { user, profile } = useAuthStore();
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [tick, setTick] = useState(0);

  // Refresh elapsed times every 30 s without re-fetching Firestore
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchUsers = async () => {
      const qUsers =
        profile.role === 'company'
          ? query(collection(db, 'users'), where('companyId', '==', user.uid))
          : query(collection(db, 'users'));
      const snapshot = await getDocs(qUsers);
      const map: Record<string, string> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        map[d.id] =
          data.firstName
            ? `${data.firstName} ${data.lastName}`
            : data.name || data.displayName || 'Conductor';
      });
      setUsers(map);
    };
    fetchUsers();

    const qRoutes =
      profile.role === 'company'
        ? query(
            collection(db, 'routes'),
            where('companyId', '==', user.uid),
            orderBy('startTime', 'desc'),
            limit(200),
          )
        : query(collection(db, 'routes'), orderBy('startTime', 'desc'), limit(200));

    const unsub = onSnapshot(qRoutes, snap => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile]);

  const activeRoutes = useMemo(
    () => routes.filter(r => r.startTime && !r.endTime),
    [routes],
  );

  const todayCompletedCount = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return routes.filter(r => r.endTime && getMs(r.endTime) >= midnight.getTime()).length;
  }, [routes]);

  // Longest active jornada — recomputed on each tick
  const longestActive = useMemo(() => {
    void tick;
    if (activeRoutes.length === 0) return '—';
    const maxMs = activeRoutes.reduce((max, r) => {
      const startMs = getMs(r.startTime);
      if (!startMs) return max;
      const elapsed = Date.now() - startMs;
      return elapsed > max ? elapsed : max;
    }, 0);
    if (maxMs === 0) return '—';
    const h = Math.floor(maxMs / 3600000);
    const m = Math.floor((maxMs % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [activeRoutes, tick]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-gray-400 italic">Cargando flota...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <Helmet>
        <title>BTS Logistics Pro - Centro de Mando</title>
      </Helmet>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Centro de Mando</h1>
        <p className="text-white/30 text-sm mt-1">Flota en tiempo real</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Truck,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            value: activeRoutes.length,
            label: 'En Ruta Ahora',
            pulse: true,
          },
          {
            icon: Users,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            value: activeRoutes.filter(r => r.hasHelper).length,
            label: 'Con Ayudante',
          },
          {
            icon: CheckCircle2,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            value: todayCompletedCount,
            label: 'Finalizadas Hoy',
          },
          {
            icon: Clock,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            value: longestActive,
            label: 'Jornada Más Larga',
            isText: true,
          },
        ].map(card => (
          <div
            key={card.label}
            className="bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col justify-between h-28"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-xl ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              {card.pulse && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h3
                className={`font-bold text-white leading-none ${
                  card.isText ? 'text-2xl' : 'text-3xl'
                }`}
              >
                {card.value}
              </h3>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Command center cards */}
      <section className="space-y-5">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Flota Activa ({activeRoutes.length})
        </h2>

        {activeRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-white/10" />
            </div>
            <p className="text-white/20 italic text-sm">
              No hay conductores en ruta en este momento
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...activeRoutes]
              .sort((a, b) => getMs(a.startTime) - getMs(b.startTime)) // oldest first = longest running
              .map(route => {
                const driverName =
                  route.driverName || users[route.driverId] || 'Conductor';
                const startMs = getMs(route.startTime);
                const elapsedH = startMs
                  ? Math.max(0, Date.now() - startMs) / 3600000
                  : 0;
                const isWarning = elapsedH >= 9;
                const isCritical = elapsedH >= 11;
                const startTimeStr = startMs
                  ? format(new Date(startMs), 'HH:mm', { locale: es })
                  : '--:--';

                return (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    className={`group cursor-pointer rounded-3xl p-5 border transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                      isCritical
                        ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/60'
                        : isWarning
                        ? 'bg-orange-500/5 border-orange-500/30 hover:border-orange-500/60'
                        : 'bg-white/[0.04] border-white/10 hover:border-blue-500/40 hover:bg-white/[0.07]'
                    }`}
                  >
                    {/* Who */}
                    <div className="flex items-start gap-4 mb-5">
                      <div className="relative shrink-0">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black border-2 ${
                            isCritical
                              ? 'bg-red-500/20 border-red-500/40 text-red-300'
                              : isWarning
                              ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                              : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                          }`}
                        >
                          {driverName.charAt(0).toUpperCase()}
                        </div>
                        {/* Live indicator */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0f172a] animate-pulse" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-base leading-tight truncate">
                          {driverName}
                        </p>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          Salida a las {startTimeStr}
                        </p>
                        {route.hasHelper && (
                          <span className="inline-block mt-1.5 text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            + Ayudante
                          </span>
                        )}
                      </div>

                      {(isWarning || isCritical) && (
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isCritical ? 'text-red-400' : 'text-orange-400'
                          }`}
                        />
                      )}
                    </div>

                    {/* Where + What */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">
                            Centro
                          </p>
                          <p className="text-sm font-semibold text-white/90 truncate">
                            {route.startCenter || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCritical
                              ? 'bg-red-500/10'
                              : isWarning
                              ? 'bg-orange-500/10'
                              : 'bg-emerald-500/10'
                          }`}
                        >
                          <Clock
                            className={`w-3.5 h-3.5 ${
                              isCritical
                                ? 'text-red-400'
                                : isWarning
                                ? 'text-orange-400'
                                : 'text-emerald-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">
                            Tiempo en Ruta
                          </p>
                          <p
                            className={`text-sm font-bold ${
                              isCritical
                                ? 'text-red-400'
                                : isWarning
                                ? 'text-orange-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {elapsedStr(route.startTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Navigation className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">
                            KM Inicio
                          </p>
                          <p className="text-sm font-semibold text-white/80">
                            {route.startKm?.toLocaleString('es-ES') ?? '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
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
