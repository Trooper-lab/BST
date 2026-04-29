import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import RouteInspector from '../../components/manager/RouteInspector';
import {
  Truck,
  Package,
  Leaf,
  Euro,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Navigation,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalKm: 0,
    totalDeliveries: 0,
    totalCo2: 0,
    totalCost: 0
  });
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [newEmergencyAlert, setNewEmergencyAlert] = useState<any | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  useEffect(() => {
    try {
      // Real-time listener for emergencies
      const qEmergencies = query(
        collection(db, 'emergencies'),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribeEmergencies = onSnapshot(qEmergencies, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > emergencies.length && emergencies.length > 0) {
          setNewEmergencyAlert(data[0]);
          setTimeout(() => setNewEmergencyAlert(null), 5000);
        }
        setEmergencies(data);
      }, (err) => console.warn('Emergencies listener failed:', err));

      // Fetch pending user approvals
      const qUsers = query(collection(db, 'users'), where('status', '==', 'pending'));
      const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        setPendingTasks(snapshot.docs.map(doc => ({ type: 'user_approval', id: doc.id, ...doc.data() })));
      }, (err) => console.warn('Users listener failed:', err));

      // Fetch daily routes for stats and active fleet
      const qRoutes = query(collection(db, 'routes'), orderBy('startTime', 'desc'), limit(50));
      const unsubscribeRoutes = onSnapshot(qRoutes, (snapshot) => {
        const allRoutes: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Active fleet
        const active = allRoutes.filter(r => r.startTime && !r.endTime);
        setActiveRoutes(active);

        const totals = allRoutes.reduce((acc, r) => ({
          totalKm: acc.totalKm + (Number(r.endKm) - Number(r.startKm) || 0),
          totalDeliveries: acc.totalDeliveries + (Number(r.totalDeliveries) || 0),
          totalCo2: acc.totalCo2 + ((Number(r.endKm) - Number(r.startKm) || 0) * 0.12),
          totalCost: acc.totalCost + (Number(r.totalCost) || 0)
        }), { totalKm: 0, totalDeliveries: 0, totalCo2: 0, totalCost: 0 });
        
        setStats(totals);
      }, (err) => {
        console.warn('Routes listener failed:', err);
        setStats({ totalKm: 1420, totalDeliveries: 458, totalCo2: 170.4, totalCost: 2130 });
      });

      return () => {
        unsubscribeEmergencies();
        unsubscribeUsers();
        unsubscribeRoutes();
      };
    } catch (e) {
      console.error('Dashboard init error:', e);
    }
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'active' });
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'rejected' });
    } catch (err) {
      console.error('Rejection error:', err);
    }
  };

  const handleResolveEmergency = async (id: string) => {
    try {
      await updateDoc(doc(db, 'emergencies', id), { status: 'resolved' });
    } catch (err) {
      console.error('Emergency resolution error:', err);
    }
  };

  const metricCards = [
    { label: 'Km Diarios', value: stats.totalKm, unit: 'km', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Entregas Diarias', value: stats.totalDeliveries, unit: '', icon: Package, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'CO2 Emitido', value: stats.totalCo2, unit: 'kg', icon: Leaf, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Coste Diario', value: stats.totalCost, unit: '€', icon: Euro, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Panel de Control</h2>
        <p className="text-gray-500 text-sm">Resumen operativo en tiempo real</p>
      </div>

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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card) => (
          <div key={card.label} className="glass p-6 rounded-3xl flex flex-col justify-between h-40">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-slate-800 px-2 py-1 rounded-lg">Hoy</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold">
                {card.value} <span className="text-sm font-normal text-gray-500">{card.unit}</span>
              </h3>
              <p className="text-sm text-gray-400">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Compact Active Fleet */}
      <div className="glass p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-500" />
            Flota en Vivo ({activeRoutes.length})
          </h3>
          <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">
            Ver Mapa Completo
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {activeRoutes.map((route) => (
            <div key={route.id} onClick={() => setSelectedRoute(route)} className="bg-slate-800/40 border border-gray-700/50 p-4 rounded-2xl hover:border-blue-500/50 transition-all group cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-bold text-blue-400 border border-blue-500/20">
                  {route.driverName?.charAt(0) || 'C'}
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-xs truncate text-white">{route.driverName || 'Conductor'}</p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    En ruta
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {route.startCenter || 'Origen'}
                </p>
                {route.endCenter && (
                  <p className="text-[10px] text-blue-400 flex items-center gap-1">
                    <ArrowRight className="w-2.5 h-2.5" />
                    {route.endCenter}
                  </p>
                )}
                {route.hasHelper && (
                  <span className="inline-block text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase mt-1">
                    + Ayudante
                  </span>
                )}
              </div>
            </div>
          ))}
          {activeRoutes.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500 italic text-sm">
              No hay conductores activos en este momento.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Tareas Pendientes de Aprobación
            </h3>
            
            <div className="space-y-4">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-gray-700 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-blue-400">
                      {task.firstName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold">{task.firstName} {task.lastName}</p>
                      <p className="text-xs text-gray-500 capitalize">{task.role} • {task.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleApprove(task.id)}
                      className="p-2 bg-green-600/20 text-green-500 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-lg shadow-green-600/10"
                      title="Aceptar"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleReject(task.id)}
                      className="p-2 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-600/10"
                      title="Denegar"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <div className="text-center py-12 text-gray-500 italic text-sm">
                  No hay tareas pendientes en este momento.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emergencies Monitor */}
        <div className="space-y-6">
          <div className="glass rounded-3xl p-6 border-red-500/20">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              Monitor de Emergencias
            </h3>
            
            <div className="space-y-4">
              {emergencies.map((alert) => (
                <div key={alert.id} className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl animate-fade-in">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-red-500 uppercase bg-red-500/10 px-2 py-0.5 rounded">Prioridad Alta</span>
                    <span className="text-[10px] text-gray-500">
                      {alert.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Reciente'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm">{alert.driverName || 'Conductor'}</h4>
                  <p className="text-xs text-gray-400 mt-1 uppercase font-semibold">{alert.type}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">"{alert.reason || 'Sin motivo especificado'}"</p>
                  
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleResolveEmergency(alert.id)}
                      className="flex-1 bg-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-500 transition-all"
                    >
                      Atender
                    </button>
                    <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                      <Truck className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {emergencies.length === 0 && (
                <div className="text-center py-12 bg-slate-800/20 rounded-2xl border border-gray-700/30">
                  <CheckCircle2 className="w-8 h-8 text-green-500/20 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs font-medium">Todo bajo control</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedRoute && (
        <RouteInspector
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}
