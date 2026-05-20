import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { Calendar, Loader2, Euro, Building2, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CompanyPayoutsView() {
  const { profile, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

  const fetchMonthData = async (month: Date) => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const monthStr = format(month, 'yyyy-MM');

      // Fetch official consolidated invoice (should be exactly 1 or 0)
      const invQ = query(collection(db, 'company_invoices'), where('period', '==', monthStr), where('companyId', '==', user.uid));
      const invSnap = await getDocs(invQ);
      if (!invSnap.empty) {
        setInvoice({ id: invSnap.docs[0].id, ...invSnap.docs[0].data() });
      } else {
        setInvoice(null);
      }

      // Fetch Locations
      const locQ = query(collection(db, 'locations'));
      const locSnap = await getDocs(locQ);
      setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch drivers for this company to identify routes
      const uQ = query(collection(db, 'users'));
      const uSnap = await getDocs(uQ);
      const allUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const compDrivers = allUsers.filter(u => u.companyId === user.uid || u.id === user.uid);
      const driverIds = compDrivers.map(d => d.id);

      // Fetch Routes
      const rQ = query(collection(db, 'routes'), where('status', '==', 'completed'));
      const rSnap = await getDocs(rQ);
      const filteredRoutes = rSnap.docs.map(d => ({id: d.id, ...d.data()})).filter((r: any) => {
        if (!r.endTime || !driverIds.includes(r.driverId)) return false;
        const d = r.endTime.toDate ? r.endTime.toDate() : new Date(r.endTime);
        return d >= start && d <= end;
      });
      setRoutes(filteredRoutes);
      
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'company' || profile?.role === 'autonomo') {
      fetchMonthData(selectedMonth);
    }
  }, [selectedMonth, profile, user]);

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return { value: startOfMonth(d).toISOString(), label: format(d, 'MMMM yyyy', { locale: es }) };
  });

  const aggregates = useMemo(() => {
    const map = new Map<string, any>();
    
    locations.forEach(loc => {
      map.set(loc.name, {
        centerName: loc.name,
        totalRoutes: 0,
        totalDeliveries: 0,
        totalHours: 0
      });
    });

    routes.forEach(route => {
      const center = route.endCenter;
      if (!center) return;
      if (!map.has(center)) {
        map.set(center, { centerName: center, totalRoutes: 0, totalDeliveries: 0, totalHours: 0 });
      }
      const data = map.get(center);
      data.totalRoutes += 1;
      data.totalDeliveries += Number(route.totalDeliveries) || 0;
      data.totalHours += Number(route.autoHours) || 0;
    });

    return Array.from(map.values()).filter(a => a.totalRoutes > 0);
  }, [routes, locations]);

  const totalRutas = aggregates.reduce((a, agg) => a + agg.totalRoutes, 0);

  if (profile?.role !== 'company' && profile?.role !== 'autonomo') {
    return (
      <div className="p-8 text-center text-white/50">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Esta sección es exclusiva para Empresas y Autónomos.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      <Helmet>
        <title>BTS Logistics Pro - Mis Ganancias</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Euro className="w-8 h-8 text-emerald-500" />
            Mis Ganancias
            {invoice && (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-emerald-500/30 ml-2">
                Facturado
              </span>
            )}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Resumen de actividad y facturación mensual.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
          <Calendar className="w-5 h-5 text-white/40 ml-2" />
          <select 
            value={selectedMonth.toISOString()}
            onChange={e => setSelectedMonth(new Date(e.target.value))}
            className="bg-transparent text-white font-bold outline-none cursor-pointer pr-4"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-white/20">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">Sincronizando datos...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform">
                <Euro className="w-32 h-32 text-emerald-400" />
              </div>
              <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest mb-2 relative z-10">
                Total Factura Consolidada
              </p>
              {invoice ? (
                <div className="relative z-10">
                  <p className="text-4xl font-black text-white">{invoice.totalFactura.toFixed(2)}€</p>
                  <p className="text-xs text-emerald-400 mt-2 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Facturado el {format(invoice.generatedAt?.toDate ? invoice.generatedAt.toDate() : new Date(invoice.generatedAt), 'dd/MM/yyyy')}
                  </p>
                </div>
              ) : (
                <div className="relative z-10">
                  <p className="text-xl font-bold text-white/40">Pendiente de facturar</p>
                  <p className="text-xs text-amber-400 mt-2 font-bold uppercase tracking-wider">Esperando aprobación de superadmin</p>
                </div>
              )}
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-400" /> Actividad Mensual
              </p>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold text-white">{aggregates.length}</p>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mt-1">Centros Operados</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{totalRutas}</p>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mt-1">Rutas Totales</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 mt-8">
            <h3 className="font-bold text-white flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Desglose de Actividad por Centro Logístico (Informativo)
            </h3>
            
            {aggregates.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <MapPin className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white/40 mb-1">Sin Actividad</h3>
                <p className="text-white/30 text-sm">No has completado rutas en este periodo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aggregates.map((agg, idx) => (
                  <div key={idx} className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{agg.centerName}</h4>
                        <p className="text-[9px] text-white/30 uppercase tracking-widest">Actividad</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Rutas</p>
                        <p className="text-lg font-bold text-white">{agg.totalRoutes}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Entregas</p>
                        <p className="text-lg font-bold text-white">{agg.totalDeliveries}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Horas</p>
                        <p className="text-lg font-bold text-white">{agg.totalHours.toFixed(1)}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
