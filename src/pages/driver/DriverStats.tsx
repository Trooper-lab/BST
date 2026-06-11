import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { BarChart3, TrendingUp, Truck, CheckCircle2, Euro, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc } from 'firebase/firestore';

export default function DriverStats() {
  const [viewType, setViewType] = useState<'month' | 'year'>('month');
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingHelper, setUpdatingHelper] = useState(false);
  const { user, profile, setProfile } = useAuthStore();

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      setLoading(true);
      try {
        const now = new Date();
        const startDate = viewType === 'month' 
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : new Date(now.getFullYear(), 0, 1);

        const q = query(
          collection(db, 'routes'),
          where('driverId', '==', user.uid),
          where('status', '==', 'completed'),
          where('endTime', '>=', startDate),
          orderBy('endTime', 'desc')
        );
        const snapshot = await getDocs(q);
        const routeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRoutes(routeData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user, viewType]);

  const handleToggleFixedHelper = async () => {
    if (!user || !profile) return;
    setUpdatingHelper(true);
    try {
      const newFixedHelper = !profile.fixedHelper;
      await updateDoc(doc(db, 'users', user.uid), {
        fixedHelper: newFixedHelper
      });
      setProfile({ ...profile, fixedHelper: newFixedHelper });
    } catch (err) {
      console.error("Error updating fixed helper:", err);
    } finally {
      setUpdatingHelper(false);
    }
  };

  const getMs = (val: any) => {
    if (!val) return 0;
    if (val.toDate) return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const calculateTotals = () => {
    return routes.reduce((acc, curr) => {
      const startMs = getMs(curr.startTime);
      const endMs = getMs(curr.endTime);
      const hours = (startMs && endMs) ? (endMs - startMs) / (1000 * 60 * 60) : 0;
      
      // Extra hours threshold: user.markedHours or default 9
      const threshold = profile?.markedHours || 9;
      const extraHours = Math.max(0, hours - threshold);
      
      const km = (Number(curr.endKm) || 0) - (Number(curr.startKm) || 0);
      const kmRate = profile?.kmRate || 0;
      const extraRate = profile?.extraHourRate || 0;
      
      // Total cost calculation: (KM * kmRate) + (ExtraHours * extraRate)
      const cost = Number(curr.totalCost) || ((km * kmRate) + (extraHours * extraRate));

      return {
        km: acc.km + (km > 0 ? km : 0),
        deliveries: acc.deliveries + (Number(curr.totalDeliveries) || 0),
        hours: acc.hours + extraHours,
        earnings: acc.earnings + cost
      };
    }, { km: 0, deliveries: 0, hours: 0, earnings: 0 });
  };

  const totals = calculateTotals();
  const earnings = totals.earnings.toFixed(2);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Resumen de Actividad</h2>
        <div className="flex bg-slate-800/50 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setViewType('month')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewType === 'month' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            MENSUAL
          </button>
          <button 
            onClick={() => setViewType('year')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewType === 'year' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            ANUAL
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <div className="glass px-3 py-1 rounded-full text-[10px] text-green-400 font-bold border border-green-500/20">
          {profile?.kmRate || 0} €/km
        </div>
        <div className="glass px-3 py-1 rounded-full text-[10px] text-purple-400 font-bold border border-purple-500/20">
          EXTRA: {profile?.extraHourRate || 0} €/h
        </div>
        <div className="glass px-3 py-1 rounded-full text-[10px] text-amber-400 font-bold border border-amber-500/20">
          UMBRAL: {profile?.markedHours || 9}h
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-4 rounded-3xl">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center mb-3">
            <Truck className="text-blue-500 w-6 h-6" />
          </div>
          <p className="text-sm text-gray-400">Distancia</p>
          <h3 className="text-xl font-bold">{totals.km} <span className="text-xs font-normal text-gray-500">KM</span></h3>
        </div>
        <div className="glass p-4 rounded-3xl">
          <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle2 className="text-green-500 w-6 h-6" />
          </div>
          <p className="text-sm text-gray-400">Repartos</p>
          <h3 className="text-xl font-bold">{totals.deliveries}</h3>
        </div>
        <div className="glass p-4 rounded-3xl">
          <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center mb-3">
            <Clock className="text-emerald-500 w-6 h-6" />
          </div>
          <p className="text-sm text-gray-400">Horas Extra</p>
          <h3 className="text-xl font-bold text-emerald-400">{totals.hours.toFixed(1)} <span className="text-xs font-normal text-gray-500">h</span></h3>
        </div>
        <div className="glass p-4 rounded-3xl group hover:bg-slate-800/40 transition-all border-l-4 border-l-purple-500">
          <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center mb-3">
            <Euro className="text-purple-500 w-6 h-6" />
          </div>
          <p className="text-sm text-gray-400">Pago Est.</p>
          <h3 className="text-xl font-bold gradient-text">{earnings} €</h3>
        </div>
      </div>

      {/* Recent History */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Últimos Viajes
          </h3>
          <button className="text-xs text-blue-400 hover:underline">Ver todo</button>
        </div>
        
        <div className="divide-y divide-gray-800">
          {routes.map((route) => {
            const endMs = getMs(route.endTime);
            const date = endMs ? new Date(endMs) : null;
            
            return (
              <div key={route.id} className="p-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-gray-500 font-bold text-xs">
                    {date ? format(date, 'dd', { locale: es }) : '--'}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {date ? format(date, 'EEEE, d MMMM', { locale: es }) : 'Cargando...'}
                    </p>
                    <p className="text-xs text-gray-500">{(Number(route.endKm) || 0) - (Number(route.startKm) || 0)} KM • {route.totalDeliveries || 0} repartos</p>
                  </div>
                </div>
                <TrendingUp className="text-green-500 w-4 h-4" />
              </div>
            );
          })}
          {routes.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500 text-sm italic">
              No hay rutas registradas recientemente.
            </div>
          )}
        </div>
      </div>

      {/* Settings / Fixed Helper */}
      <div className="glass p-4 rounded-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-red-400">¿Ayudante fijo?</h3>
            <p className="text-xs text-gray-500">Bloquea la opción al inicio de jornada</p>
          </div>
          <button
            onClick={handleToggleFixedHelper}
            disabled={updatingHelper}
            className={`w-12 h-6 rounded-full p-1 transition-all ${profile?.fixedHelper ? 'bg-red-500' : 'bg-gray-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-all ${profile?.fixedHelper ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
