import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { FileText, Calendar, Loader2, Building2, MapPin, CheckCircle2, ChevronRight, Users, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function InvoicesView() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [companyInvoices, setCompanyInvoices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<'centers' | 'providers'>('centers');

  const fetchMonthData = async (month: Date) => {
    setLoading(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      // Fetch locations (centers)
      const locsQ = query(collection(db, 'locations'));
      const locsSnap = await getDocs(locsQ);
      setLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch all users (for providers calculation)
      const usersQ = query(collection(db, 'users'));
      const usersSnap = await getDocs(usersQ);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch routes
      const routesQ = query(
        collection(db, 'routes'),
        where('status', '==', 'completed')
      );
      const routesSnap = await getDocs(routesQ);
      const allRoutes = routesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const filteredRoutes = allRoutes.filter((r: any) => {
        if (!r.endTime) return false;
        const d = r.endTime.toDate ? r.endTime.toDate() : new Date(r.endTime);
        return d >= start && d <= end;
      });
      setRoutes(filteredRoutes);

      // Fetch already generated invoices for this month
      const monthStr = format(month, 'yyyy-MM');
      const invQ = query(collection(db, 'invoices'), where('period', '==', monthStr));
      const invSnap = await getDocs(invQ);
      setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const cInvQ = query(collection(db, 'company_invoices'), where('period', '==', monthStr));
      const cInvSnap = await getDocs(cInvQ);
      setCompanyInvoices(cInvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'superadmin') {
      fetchMonthData(selectedMonth);
    }
  }, [selectedMonth, profile]);

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return { value: startOfMonth(d).toISOString(), label: format(d, 'MMMM yyyy', { locale: es }) };
  });

  const aggregates = useMemo(() => {
    const map = new Map<string, any>();
    
    // Initialize map with all known locations
    locations.forEach(loc => {
      map.set(loc.name, {
        centerName: loc.name,
        totalRoutes: 0,
        totalDeliveries: 0,
        totalCost: 0,
        totalKm: 0,
        totalHours: 0
      });
    });

    routes.forEach(route => {
      const center = route.endCenter;
      if (!center) return;
      
      if (!map.has(center)) {
        map.set(center, {
          centerName: center,
          totalRoutes: 0,
          totalDeliveries: 0,
          totalCost: 0,
          totalKm: 0,
          totalHours: 0
        });
      }
      
      const data = map.get(center);
      data.totalRoutes += 1;
      data.totalDeliveries += Number(route.totalDeliveries) || 0;
      data.totalCost += Number(route.totalCost) || 0;
      data.totalKm += (Number(route.endKm) || 0) - (Number(route.startKm) || 0);
      data.totalHours += Number(route.autoHours) || 0;
    });

    return Array.from(map.values()).filter(a => a.totalRoutes > 0);
  }, [routes, locations]);




  const providersData = useMemo(() => {
    const companies = users.filter(u => u.role === 'company' || u.role === 'autonomo');
    
    return companies.map(company => {
      const companyDrivers = users.filter(u => u.companyId === company.id || u.id === company.id);
      
      let totalRoutes = 0;
      let centers = new Set<string>();
      
      companyDrivers.forEach(driver => {
        const driverRoutes = routes.filter(r => r.driverId === driver.id);
        totalRoutes += driverRoutes.length;
        driverRoutes.forEach(r => {
          if (r.endCenter) centers.add(r.endCenter);
        });
      });

      return {
        company,
        totalRoutes,
        totalDrivers: companyDrivers.filter(d => routes.some(r => r.driverId === d.id)).length,
        totalCenters: centers.size
      };
    }).filter(p => p.totalRoutes > 0);
  }, [users, routes]);


  if (profile?.role !== 'superadmin') {
    return (
      <div className="p-8 text-center text-white/50">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      <Helmet>
        <title>BTS Logistics Pro - Facturación</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            Facturación y Pagos
          </h1>
          <p className="text-white/40 text-sm mt-1">Generación de facturas por centro logístico y pagos a proveedores.</p>
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

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('centers')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'centers' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          Centros Logísticos (Ingresos)
        </button>
        <button 
          onClick={() => setActiveTab('providers')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'providers' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          Proveedores (Pagos)
        </button>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-white/20">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">Calculando agregados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {activeTab === 'centers' && (
            aggregates.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <MapPin className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white/40 mb-1">Sin Actividad</h3>
                <p className="text-white/30 text-sm">No hay rutas completadas en este periodo.</p>
              </div>
            ) : (
              aggregates.map((agg, idx) => {
                const existingInvoice = invoices.find(inv => inv.centerName === agg.centerName);
                return (
                  <div key={idx} className="bg-slate-900/50 border border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <Building2 className="w-48 h-48 text-blue-500" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-white">{agg.centerName}</h2>
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Centro Logístico</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-6 mt-6">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Rutas</p>
                            <p className="text-xl font-bold text-white">{agg.totalRoutes}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Entregas</p>
                            <p className="text-xl font-bold text-white">{agg.totalDeliveries}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Horas</p>
                            <p className="text-xl font-bold text-white">{agg.totalHours.toFixed(1)}h</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end justify-between h-full min-h-[100px] border-l border-white/10 pl-6">
                        <div className="text-left md:text-right mb-6">
                          <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest mb-1">Total a Facturar</p>
                          <p className="text-4xl font-black text-white">{agg.totalCost.toFixed(2)}€</p>
                        </div>

                        {existingInvoice ? (
                          <button
                            onClick={() => navigate(`/manager/invoices/${existingInvoice.id}`)}
                            className="flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-xl border border-emerald-500/20 transition-all font-bold text-sm"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Ver Factura
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/manager/invoices/new?center=${encodeURIComponent(agg.centerName)}&period=${format(selectedMonth, 'yyyy-MM')}`)}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
                          >
                            <FileText className="w-5 h-5" />
                            Revisar y Generar Factura
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {activeTab === 'providers' && (
            providersData.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white/40 mb-1">Sin Proveedores</h3>
                <p className="text-white/30 text-sm">No hay actividad de proveedores en este periodo.</p>
              </div>
            ) : (
              providersData.map((prov, idx) => {
                const existingInvoice = companyInvoices.find(inv => inv.companyId === prov.company.id);
                return (
                <div key={idx} className="bg-slate-900/50 border border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <Users className="w-48 h-48 text-emerald-500" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                          <Users className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-white">{prov.company.companyName || `${prov.company.firstName} ${prov.company.lastName}`}</h2>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{prov.company.role === 'company' ? 'Empresa' : 'Autónomo'}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-6 mt-6">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Centros Logísticos</p>
                          <p className="text-xl font-bold text-white">{prov.totalCenters}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Conductores</p>
                          <p className="text-xl font-bold text-white">{prov.totalDrivers}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Rutas</p>
                          <p className="text-xl font-bold text-white">{prov.totalRoutes}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-between h-full min-h-[100px] border-l border-white/10 pl-6 gap-4">
                      {existingInvoice && (
                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest mb-1">Total Facturado</p>
                          <p className="text-4xl font-black text-white">{existingInvoice.totalFactura.toFixed(2)}€</p>
                        </div>
                      )}

                      {existingInvoice ? (
                        <button
                          onClick={() => navigate(`/manager/payouts/${existingInvoice.id}`)}
                          className="flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-xl border border-emerald-500/20 transition-all font-bold text-sm"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Ver Factura Consolidada
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/manager/payouts/new?companyId=${prov.company.id}&period=${format(selectedMonth, 'yyyy-MM')}`)}
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20"
                        >
                          <FileText className="w-5 h-5" />
                          Generar Factura Consolidada
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
            )
          )}
        </div>
      )}
    </div>
  );
}
