import { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Truck, Package, Leaf, Euro, AlertCircle, CheckCircle2, XCircle,
  Clock, Users, MapPin,
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [monthRoutes, setMonthRoutes] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [newEmergencyAlert, setNewEmergencyAlert] = useState<any | null>(null);
  const emergenciesRef = useRef<any[]>([]);

  const { user, profile } = useAuthStore();

  const monthStart = startOfMonth(new Date());
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: es });

  useEffect(() => {
    if (!user || !profile) return;
    const isCompany = profile.role === 'company';

    const qEmergencies = isCompany
      ? query(collection(db, 'emergencies'), where('status', '==', 'active'), where('companyId', '==', user.uid), orderBy('timestamp', 'desc'))
      : query(collection(db, 'emergencies'), where('status', '==', 'active'), orderBy('timestamp', 'desc'));

    const unsubEmergencies = onSnapshot(qEmergencies, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > emergenciesRef.current.length && emergenciesRef.current.length > 0) {
        setNewEmergencyAlert(data[0]);
        setTimeout(() => setNewEmergencyAlert(null), 5000);
      }
      emergenciesRef.current = data;
      setEmergencies(data);
    }, err => console.warn('Emergencies:', err));

    const qUsers = isCompany
      ? query(collection(db, 'users'), where('status', '==', 'pending'), where('companyId', '==', user.uid))
      : query(collection(db, 'users'), where('status', '==', 'pending'));

    const unsubUsers = onSnapshot(qUsers, snap => {
      const tasks = snap.docs.map(d => ({ type: 'user_approval', id: d.id, ...d.data() as any }));
      setPendingTasks(tasks);
    }, err => console.warn('Users:', err));

    const qRoutes = isCompany
      ? query(collection(db, 'routes'), where('companyId', '==', user.uid), where('startTime', '>=', monthStart), orderBy('startTime', 'desc'))
      : query(collection(db, 'routes'), where('startTime', '>=', monthStart), orderBy('startTime', 'desc'));

    const unsubRoutes = onSnapshot(qRoutes, snap => {
      setMonthRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Routes:', err));

    return () => {
      unsubEmergencies();
      unsubUsers();
      unsubRoutes();
    };
  }, [user, profile]);

  const completedRoutes = useMemo(
    () => monthRoutes.filter(r => r.endTime),
    [monthRoutes],
  );

  const activeNow = useMemo(
    () => monthRoutes.filter(r => r.startTime && !r.endTime).length,
    [monthRoutes],
  );

  const kpis = useMemo(() =>
    completedRoutes.reduce(
      (acc, r) => ({
        routes: acc.routes + 1,
        deliveries: acc.deliveries + (Number(r.totalDeliveries) || 0),
        km: acc.km + ((Number(r.endKm) - Number(r.startKm)) || 0),
        cost: acc.cost + (Number(r.totalCost) || 0),
        extraHours: acc.extraHours + (Number(r.extraHours) || 0),
        co2: acc.co2 + ((Number(r.endKm) - Number(r.startKm)) || 0) * 0.12,
      }),
      { routes: 0, deliveries: 0, km: 0, cost: 0, extraHours: 0, co2: 0 },
    ),
    [completedRoutes],
  );

  const topDrivers = useMemo(() => {
    const map: Record<string, { name: string; routes: number; km: number; deliveries: number; cost: number }> = {};
    completedRoutes.forEach(r => {
      const id = r.driverId;
      if (!map[id]) map[id] = { name: r.driverName || 'Conductor', routes: 0, km: 0, deliveries: 0, cost: 0 };
      map[id].routes++;
      map[id].km += (Number(r.endKm) - Number(r.startKm)) || 0;
      map[id].deliveries += Number(r.totalDeliveries) || 0;
      map[id].cost += Number(r.totalCost) || 0;
    });
    return Object.values(map).sort((a, b) => b.deliveries - a.deliveries).slice(0, 8);
  }, [completedRoutes]);

  const topCenters = useMemo(() => {
    const map: Record<string, { routes: number; deliveries: number }> = {};
    completedRoutes.forEach(r => {
      const name = r.startCenter || 'Desconocido';
      if (!map[name]) map[name] = { routes: 0, deliveries: 0 };
      map[name].routes++;
      map[name].deliveries += Number(r.totalDeliveries) || 0;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.routes - a.routes)
      .slice(0, 6)
      .map(([name, s]) => ({ name, ...s }));
  }, [completedRoutes]);

  const maxCenterRoutes = Math.max(...topCenters.map(c => c.routes), 1);

  const handleApprove = (id: string) =>
    updateDoc(doc(db, 'users', id), { status: 'active' }).catch(console.error);

  const handleReject = (id: string) =>
    updateDoc(doc(db, 'users', id), { status: 'rejected' }).catch(console.error);

  const handleResolveEmergency = (id: string) =>
    updateDoc(doc(db, 'emergencies', id), { status: 'resolved' }).catch(console.error);

  return (
    <div className="space-y-8">
      <Helmet>
        <title>BTS Logistics Pro - Resumen Mensual</title>
      </Helmet>

      {/* Emergency banner */}
      {newEmergencyAlert && (
        <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center justify-between animate-bounce shadow-2xl shadow-red-600/40 border border-red-400/20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="font-bold">¡EMERGENCIA ACTIVA!</p>
              <p className="text-sm opacity-90">{newEmergencyAlert.driverName} ha solicitado ayuda</p>
            </div>
          </div>
          <button
            onClick={() => setNewEmergencyAlert(null)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-xs text-white/30 uppercase tracking-widest font-bold mb-1">
          Resumen mensual
        </p>
        <h2 className="text-3xl font-black text-white capitalize">{monthLabel}</h2>
        <p className="text-sm text-white/40 mt-1">
          {kpis.routes} rutas completadas
          {activeNow > 0 && (
            <span className="ml-2 text-emerald-400 font-bold">
              · {activeNow} en curso ahora
            </span>
          )}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {([
          { label: 'Rutas', value: kpis.routes.toString(), unit: '', icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Entregas', value: kpis.deliveries.toLocaleString('es-ES'), unit: '', icon: Package, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Kilómetros', value: Math.round(kpis.km).toLocaleString('es-ES'), unit: 'km', icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Coste Total', value: kpis.cost.toFixed(0), unit: '€', icon: Euro, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Horas Extra', value: kpis.extraHours.toFixed(1), unit: 'h', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'CO₂ Emitido', value: Math.round(kpis.co2).toLocaleString('es-ES'), unit: 'kg', icon: Leaf, color: 'text-teal-400', bg: 'bg-teal-500/10' },
        ] as const).map(card => (
          <div key={card.label} className="glass p-5 rounded-3xl flex flex-col justify-between h-36">
            <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-white leading-none">
                {card.value}
                {card.unit && (
                  <span className="text-sm font-normal text-white/40 ml-1">{card.unit}</span>
                )}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: top drivers + top centers */}
        <div className="lg:col-span-2 space-y-8">

          {/* Top Drivers */}
          <div className="glass rounded-3xl p-6">
            <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Top Conductores
            </h3>
            {topDrivers.length === 0 ? (
              <p className="text-white/20 italic text-sm text-center py-10">
                Sin rutas completadas este mes
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Conductor', 'Rutas', 'Entregas', 'KM', 'Coste'].map((h, i) => (
                        <th
                          key={h}
                          className={`pb-3 text-[10px] font-bold text-white/30 uppercase tracking-wider ${i > 0 ? 'text-right' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topDrivers.map((d, i) => (
                      <tr key={d.name + i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 font-bold text-xs border border-blue-500/10 shrink-0">
                              {d.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-white/80 truncate max-w-[160px]">
                              {d.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-white">{d.routes}</td>
                        <td className="py-3 text-right text-sm font-bold text-green-400">
                          {d.deliveries.toLocaleString('es-ES')}
                        </td>
                        <td className="py-3 text-right text-sm text-white/50">
                          {Math.round(d.km).toLocaleString('es-ES')}
                        </td>
                        <td className="py-3 text-right text-sm text-emerald-400">
                          {d.cost.toFixed(0)}€
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Centers */}
          <div className="glass rounded-3xl p-6">
            <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              Centros Más Activos
            </h3>
            {topCenters.length === 0 ? (
              <p className="text-white/20 italic text-sm text-center py-10">
                Sin datos este mes
              </p>
            ) : (
              <div className="space-y-3">
                {topCenters.map(center => (
                  <div key={center.name} className="flex items-center gap-4">
                    <p className="text-sm text-white/70 w-44 shrink-0 truncate">{center.name}</p>
                    <div className="flex-1 relative h-7 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-purple-500/25 rounded-lg transition-all duration-700"
                        style={{ width: `${(center.routes / maxCenterRoutes) * 100}%` }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white/50">
                        {center.routes} rutas · {center.deliveries.toLocaleString('es-ES')} entregas
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: approvals + emergencies */}
        <div className="space-y-8">

          {/* Pending Approvals */}
          <div className="glass rounded-3xl p-6">
            <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Aprobaciones Pendientes
            </h3>
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-2xl border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-blue-400 shrink-0 text-sm">
                      {task.firstName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">
                        {task.firstName} {task.lastName}
                      </p>
                      <p className="text-[10px] text-white/40 capitalize">{task.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => handleApprove(task.id)}
                      className="p-1.5 bg-green-600/20 text-green-500 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                      title="Aprobar"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReject(task.id)}
                      className="p-1.5 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                      title="Rechazar"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <div className="text-center py-10 text-white/20 text-sm italic">
                  Sin pendientes
                </div>
              )}
            </div>
          </div>

          {/* Emergencies */}
          <div className="glass rounded-3xl p-6">
            <h3 className="text-base font-bold text-red-400 mb-5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 animate-pulse" />
              Emergencias Activas
            </h3>
            <div className="space-y-3">
              {emergencies.map(alert => (
                <div
                  key={alert.id}
                  className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-bold text-red-500 uppercase bg-red-500/10 px-2 py-0.5 rounded">
                      Alta
                    </span>
                    <span className="text-[10px] text-white/30">
                      {alert.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '—'}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-white">{alert.driverName || 'Conductor'}</p>
                  <p className="text-[11px] text-white/50 mt-1 italic line-clamp-2">
                    "{alert.reason || 'Sin motivo especificado'}"
                  </p>
                  <button
                    onClick={() => handleResolveEmergency(alert.id)}
                    className="mt-3 w-full bg-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-500 transition-all"
                  >
                    Atender
                  </button>
                </div>
              ))}
              {emergencies.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-8 h-8 text-green-500/20 mx-auto mb-2" />
                  <p className="text-white/20 text-xs">Todo bajo control</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
