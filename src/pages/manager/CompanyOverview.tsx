import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Euro,
  ArrowLeft, Truck, FileText, Loader2, CheckCircle2,
  Clock, Link, Check
} from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';

interface CompanyOverviewProps {
  company: any;
  onBack: () => void;
}

export default function CompanyOverview({ company, onBack }: CompanyOverviewProps) {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch drivers for this company
        const driversQ = query(collection(db, 'users'), where('companyId', '==', company.id));
        const driversSnap = await getDocs(driversQ);
        const driversData = driversSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDrivers(driversData);

        // Fetch routes for these drivers
        const driverIds = driversData.map(d => d.id);
        
        if (driverIds.length > 0) {
          // We can batch query if there are <= 10 drivers using 'in', but if there are more we might need to fetch all routes and filter, or fetch per driver.
          // For simplicity, fetch routes where driverId in driverIds (up to 10 chunks)
          
          const routesData: any[] = [];
          
          // Split driverIds into chunks of 10 for Firestore 'in' query
          const chunks = [];
          for (let i = 0; i < driverIds.length; i += 10) {
            chunks.push(driverIds.slice(i, i + 10));
          }

          for (const chunk of chunks) {
            const routesQ = query(
              collection(db, 'routes'),
              where('driverId', 'in', chunk),
              where('status', '==', 'completed')
            );
            const routesSnap = await getDocs(routesQ);
            routesSnap.docs.forEach(d => {
              routesData.push({ id: d.id, ...d.data() });
            });
          }
          
          // Sort by endTime desc manually since we fetched in chunks
          routesData.sort((a, b) => {
            const timeA = a.endTime?.toDate ? a.endTime.toDate().getTime() : new Date(a.endTime).getTime();
            const timeB = b.endTime?.toDate ? b.endTime.toDate().getTime() : new Date(b.endTime).getTime();
            return timeB - timeA;
          });
          
          setRoutes(routesData.slice(0, 100)); // Limit to last 100
        } else {
          setRoutes([]);
        }
      } catch (err) {
        console.error('Error fetching company data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [company.id]);

  const getMs = (val: any) => {
    if (!val) return 0;
    if (val.toDate) return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const routeHours = (r: any) => {
    if (r.submittedHours) return Number(r.submittedHours);
    const s = getMs(r.startTime), e = getMs(r.endTime);
    return (s && e) ? (e - s) / 3600000 : 0;
  };

  const calculateStats = () => {
    const now = new Date();
    const monthRoutes = routes.filter(r => {
      const ms = getMs(r.endTime);
      if (!ms) return false;
      const d = new Date(ms);
      return d >= startOfMonth(now) && d <= endOfMonth(now);
    });

    const totalHours = monthRoutes.reduce((a, r) => a + routeHours(r), 0);
    const totalKm = monthRoutes.reduce((a, r) => a + ((Number(r.endKm) || 0) - (Number(r.startKm) || 0)), 0);
    const totalDeliveries = monthRoutes.reduce((a, r) => a + (Number(r.totalDeliveries) || 0), 0);
    
    // Simplified cost calculation (you might want to use exact driver rates in the future)
    const monthlyPay = monthRoutes.reduce((a, r) => {
      if (Number(r.totalCost)) return a + Number(r.totalCost);
      return a; // If not pre-calculated, we skip for aggregate to avoid complex logic without driver specific rates
    }, 0);

    return { totalHours, totalKm, totalDeliveries, monthlyPay };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-gray-400 italic">Cargando datos de la empresa...</p>
      </div>
    );
  }

  const stats = calculateStats();

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/register?companyId=${company.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Volver al Directorio
        </button>
        
        <button 
          onClick={handleCopyLink}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            copiedLink 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
              : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
          }`}
        >
          {copiedLink ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
          {copiedLink ? 'Enlace Copiado' : 'Copiar Enlace de Invitación'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Company Identity */}
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-blue-600/20 to-transparent border border-blue-500/20 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Building2 className="w-32 h-32 text-blue-500" />
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-blue-600 rounded-3xl shadow-2xl flex items-center justify-center text-3xl font-bold mb-4">
                {company.firstName?.charAt(0) || 'E'}
              </div>
              <h1 className="text-2xl font-bold text-white">{company.firstName} {company.lastName}</h1>
              <p className="text-blue-400 font-medium uppercase text-xs tracking-widest mt-1">Perfil de Empresa</p>

              <div className="mt-8 w-full space-y-3 text-left">
                <div className="flex items-center gap-3 text-white/60">
                  <Euro className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">Email: {company.email || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">CIF / DNI: {company.dni || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <Users className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">{drivers.length} Conductores Asociados</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Stats and Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Users className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-xs text-white/40">Conductores</p>
              <h4 className="text-2xl font-bold text-white">{drivers.length}</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Truck className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-xs text-white/40">KM Totales (Mes)</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalKm}</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-xs text-white/40">Entregas (Mes)</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalDeliveries}</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Clock className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-xs text-white/40">Horas (Mes)</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalHours.toFixed(1)}h</h4>
            </div>
          </div>

          {/* Drivers List */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Flota de Conductores
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Conductor</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">DNI</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {drivers.map(driver => (
                    <tr 
                      key={driver.id} 
                      onClick={() => navigate(`/manager/drivers/${driver.id}`)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-medium text-white">
                        {driver.firstName} {driver.lastName}
                      </td>
                      <td className="px-5 py-3 text-white/60">{driver.email || '—'}</td>
                      <td className="px-5 py-3 text-white/60 font-mono text-xs">{driver.dni || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                          driver.status === 'active' ? 'bg-green-500/10 text-green-400' : 
                          driver.status === 'inactive' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {driver.status === 'active' ? 'Activo' : driver.status === 'inactive' ? 'Inactivo' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-white/20 italic text-sm">
                        No hay conductores asociados a esta empresa
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
