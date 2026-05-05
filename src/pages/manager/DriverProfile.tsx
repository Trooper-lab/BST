import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  User, Mail, Calendar, Clock, Euro,
  ArrowLeft, Edit2, Check, X, Loader2, Truck,
  CheckCircle2, CreditCard, FileText, Leaf
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import CompanyOverview from './CompanyOverview';

const VEHICLE_TYPES = [
  { value: 'vehic_gas',     label: 'VEHÍC. GAS',    co2: 0.18 },
  { value: 'veh_gas_mixto', label: 'VEH.GAS-MIXTO', co2: 0.22 },
  { value: 'furgo_gas',     label: 'FURGO GAS',     co2: 0.12 },
  { value: 'veh_faltantes', label: 'VEH.FALTANTES', co2: 0.00 },
];

const co2Factor = (vehicleType: string) =>
  VEHICLE_TYPES.find(v => v.value === vehicleType)?.co2 ?? 0.20;

const vehicleLabel = (vehicleType: string) =>
  VEHICLE_TYPES.find(v => v.value === vehicleType)?.label ?? 'No asignado';

export default function DriverProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    kmRate: 0,
    extraHourRate: 0,
    status: 'active',
    vehicleType: '',
    vehiclePlate: '',
    markedHours: 9,
  });

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const driverDoc = await getDoc(doc(db, 'users', id));
        if (driverDoc.exists()) {
          const data = driverDoc.data();
          setDriver({ id: driverDoc.id, ...data });
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            dni: data.dni || '',
            kmRate: data.kmRate || 0,
            extraHourRate: data.extraHourRate || 0,
            status: data.status || 'active',
            vehicleType: data.vehicleType || '',
            vehiclePlate: data.vehiclePlate || '',
            markedHours: data.markedHours || 9,
          });
        }

        const q = query(
          collection(db, 'routes'),
          where('driverId', '==', id),
          where('status', '==', 'completed'),
          orderBy('endTime', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(q);
        setRoutes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching driver data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', id), {
        ...formData,
        kmRate: Number(formData.kmRate),
        extraHourRate: Number(formData.extraHourRate),
        markedHours: Number(formData.markedHours),
      });
      setDriver({ ...driver, ...formData, kmRate: Number(formData.kmRate), extraHourRate: Number(formData.extraHourRate) });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating driver:', err);
    } finally {
      setSaving(false);
    }
  };

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
    const totalExtraHours = monthRoutes.reduce((a, r) => {
      const h = routeHours(r);
      const threshold = driver?.markedHours || 9;
      return a + Math.max(0, h - threshold);
    }, 0);
    const totalKm = monthRoutes.reduce((a, r) => a + ((Number(r.endKm) || 0) - (Number(r.startKm) || 0)), 0);
    const totalDeliveries = monthRoutes.reduce((a, r) => a + (Number(r.totalDeliveries) || 0), 0);
    
    const monthlyPay = monthRoutes.reduce((a, r) => {
      if (Number(r.totalCost)) return a + Number(r.totalCost);
      const h = routeHours(r);
      const km = (Number(r.endKm) || 0) - (Number(r.startKm) || 0);
      const threshold = driver?.markedHours || 9;
      const extra = Math.max(0, h - threshold);
      const cost = (km * (driver?.kmRate || 0)) + (extra * (driver?.extraHourRate || 0));
      return a + cost;
    }, 0);

    const co2 = totalKm * co2Factor(driver?.vehicleType || '');

    return { totalHours, totalExtraHours, totalKm, totalDeliveries, monthlyPay, co2 };
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <p className="text-gray-400 italic">Cargando perfil...</p>
    </div>
  );

  const stats = calculateStats();

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/40 outline-none";

  if (driver?.role === 'company') {
    return <CompanyOverview company={driver} onBack={() => navigate('/manager/drivers')} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/manager/drivers')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Volver al Directorio
        </button>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isEditing ? 'bg-red-500/20 text-red-400' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
          }`}
        >
          {isEditing ? <><X className="w-4 h-4" /> Cancelar</> : <><Edit2 className="w-4 h-4" /> Editar Perfil</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="space-y-6">
          {/* Identity card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <User className="w-32 h-32 text-blue-500" />
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl shadow-2xl flex items-center justify-center text-3xl font-bold mb-4">
                {driver?.firstName?.charAt(0)}{driver?.lastName?.charAt(0)}
              </div>
              <h1 className="text-2xl font-bold text-white">{driver?.firstName} {driver?.lastName}</h1>
              <p className="text-blue-400 font-medium uppercase text-xs tracking-widest mt-1">{driver?.role}</p>

              <div className="mt-8 w-full space-y-3 text-left">
                <div className="flex items-center gap-3 text-white/60">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm break-all">{driver?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">DNI: {driver?.dni || 'No asignado'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">Estado:
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                      driver?.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {driver?.status}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="text-sm">
                    <p>{vehicleLabel(driver?.vehicleType)}</p>
                    {driver?.vehiclePlate && (
                      <p className="text-xs font-mono text-white/30 mt-0.5">{driver.vehiclePlate}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit form */}
          {isEditing && (
            <form onSubmit={handleUpdate} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> Información Personal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Nombre</label>
                    <input className={inputCls} value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Apellidos</label>
                    <input className={inputCls} value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">DNI / NIE</label>
                    <input className={inputCls} value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Estado</label>
                    <select className={inputCls} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                      <option value="active">Activo</option>
                      <option value="pending">Pendiente</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Euro className="w-4 h-4" /> Configuración de Pagos
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Tarifa KM (€/km)</label>
                    <div className="relative">
                      <input type="number" step="0.01" className={inputCls} value={formData.kmRate} onChange={e => setFormData({ ...formData, kmRate: Number(e.target.value) })} />
                      <Euro className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Hora Extra (€/h)</label>
                    <div className="relative">
                      <input type="number" step="0.01" className={inputCls} value={formData.extraHourRate} onChange={e => setFormData({ ...formData, extraHourRate: Number(e.target.value) })} />
                      <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Jornada Marcada (Horas base)</label>
                  <input type="number" step="0.5" className={inputCls} value={formData.markedHours} onChange={e => setFormData({ ...formData, markedHours: Number(e.target.value) })} />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Vehículo Asignado
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Tipo de Vehículo</label>
                    <select className={inputCls} value={formData.vehicleType} onChange={e => setFormData({ ...formData, vehicleType: e.target.value })}>
                      <option value="">Sin asignar</option>
                      {VEHICLE_TYPES.map(v => (
                        <option key={v.value} value={v.value}>{v.label} — {v.co2} kg CO₂/km</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase ml-1">Matrícula</label>
                    <input className={inputCls} placeholder="Ej. 1234 ABC" value={formData.vehiclePlate} onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              </div>

              <button disabled={saving} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mt-4">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Actualizar Perfil
              </button>
            </form>
          )}

          {/* Payroll summary (view mode) */}
          {!isEditing && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Euro className="w-4 h-4 text-emerald-400" /> Tarifas Vigentes
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-2xl">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">KM</p>
                  <p className="text-xl font-bold text-white">{driver?.kmRate || 0}<span className="text-xs text-white/40 font-normal ml-1">€/km</span></p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Hora Extra</p>
                  <p className="text-xl font-bold text-white">{driver?.extraHourRate || 0}<span className="text-xs text-white/40 font-normal ml-1">€/h</span></p>
                </div>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-blue-400 uppercase font-bold">Pago Total Mes</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.monthlyPay.toFixed(2)}€</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase font-bold">Horas Extra</p>
                  <p className="text-sm font-bold text-white">{stats.totalExtraHours.toFixed(1)}h</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — stats + route history */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Truck className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-xs text-white/40">KM este mes</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalKm}</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-xs text-white/40">Entregas</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalDeliveries}</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Clock className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-xs text-white/40">Horas mes</p>
              <h4 className="text-2xl font-bold text-white">{stats.totalHours.toFixed(1)}h</h4>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
              <Leaf className="w-5 h-5 text-green-400 mb-2" />
              <p className="text-xs text-white/40">CO₂ emitido</p>
              <h4 className="text-2xl font-bold text-white">{stats.co2.toFixed(1)}<span className="text-sm font-normal text-white/40 ml-1">kg</span></h4>
              {!driver?.vehicleType && <p className="text-[10px] text-amber-400/60 mt-1">Asigna vehículo para cálculo exacto</p>}
            </div>
          </div>

          {/* Route history table */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Historial de Rutas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Fecha</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Origen → Destino</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">KM</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Horas</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Repartos</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">CO₂</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-white/40 uppercase tracking-wider">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {routes.map(route => {
                    const startMs = getMs(route.startTime);
                    const endMs = getMs(route.endTime);
                    const hours = routeHours(route);
                    const hasSubmitted = !!route.submittedHours;
                    const km = (Number(route.endKm) || 0) - (Number(route.startKm) || 0);
                    const co2 = km * co2Factor(driver?.vehicleType || '');
                    
                    const threshold = driver?.markedHours || 9;
                    const extraHours = Math.max(0, hours - threshold);
                    const pay = Number(route.totalCost) || (km * (driver?.kmRate || 0)) + (extraHours * (driver?.extraHourRate || 0));

                    return (
                      <tr key={route.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="font-medium text-white">{endMs ? format(new Date(endMs), 'dd MMM yyyy', { locale: es }) : '—'}</p>
                          <p className="text-[10px] text-white/30">{startMs ? format(new Date(startMs), 'HH:mm') : ''} → {endMs ? format(new Date(endMs), 'HH:mm') : ''}</p>
                        </td>
                        <td className="px-5 py-3 text-white/60 whitespace-nowrap text-xs">
                          {route.startCenter || '—'} → {route.endCenter || '—'}
                        </td>
                        <td className="px-5 py-3 text-white/80 tabular-nums">{km || '—'}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-white/80 tabular-nums">{hours.toFixed(1)}h</span>
                          {hasSubmitted && (
                            <span className="ml-1.5 text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">declaradas</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-white/60 tabular-nums text-center">{route.totalDeliveries ?? '—'}</td>
                        <td className="px-5 py-3 text-emerald-400/70 tabular-nums text-xs">{co2.toFixed(1)} kg</td>
                        <td className="px-5 py-3 font-bold text-emerald-400 tabular-nums whitespace-nowrap">{pay.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                  {routes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white/20 italic text-sm">Sin rutas completadas</td>
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
