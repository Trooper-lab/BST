import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { FileText, ArrowLeft, Loader2, Save, AlertCircle, Users } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';

type InvoiceRow = {
  id: string;
  category: string;
  subCategory?: string;
  label: string;
  cantidad: number;
  pvp: number;
};

const INITIAL_ROWS: InvoiceRow[] = [
  // SERVICIO FIJO
  { id: 'vehicGas', category: 'SERVICIO FIJO', label: 'VEHÍC. GAS', cantidad: 0, pvp: 0 },
  { id: 'vehicGasMixto', category: 'SERVICIO FIJO', label: 'VEH.GAS-MIXTO', cantidad: 0, pvp: 0 },
  { id: 'furgoGas', category: 'SERVICIO FIJO', label: 'FURGO GAS', cantidad: 0, pvp: 0 },
  { id: 'vehFaltantes', category: 'SERVICIO FIJO', label: 'VEH.FALTANTES', cantidad: 0, pvp: 0 },
  { id: 'acFijo', category: 'SERVICIO FIJO', label: 'AC FIJO', cantidad: 0, pvp: 0 },
  
  // FESTIVOS VEHICULO-FIJO
  { id: 'festivosFijoDiaEnt', category: 'FESTIVOS VEHICULO-FIJO', label: 'DIA-ENT.', cantidad: 0, pvp: 0 },
  { id: 'festivosFijoAc', category: 'FESTIVOS VEHICULO-FIJO', label: 'AC FESTIVO', cantidad: 0, pvp: 0 },
  
  // EXTRAS
  { id: 'jornada100', category: 'EXTRAS', subCategory: 'JORNADA', label: '100%.', cantidad: 0, pvp: 0 },
  { id: 'jornadaEspecial', category: 'EXTRAS', subCategory: 'JORNADA', label: 'ESPECIAL', cantidad: 0, pvp: 0 },
  { id: 'jornada50', category: 'EXTRAS', subCategory: 'JORNADA', label: '50%.', cantidad: 0, pvp: 0 },
  { id: 'jornadaAc', category: 'EXTRAS', subCategory: 'JORNADA', label: 'Ac', cantidad: 0, pvp: 0 },
  
  { id: 'festivosNoFijoDiaEnt', category: 'EXTRAS', subCategory: 'FESTIVOS VEHICULO NO FIJO', label: 'DIA-ENT.', cantidad: 0, pvp: 0 },
  { id: 'festivosNoFijoAc', category: 'EXTRAS', subCategory: 'FESTIVOS VEHICULO NO FIJO', label: 'AC FESTIVO', cantidad: 0, pvp: 0 },
  
  { id: 'horasExtrasVehNormal', category: 'EXTRAS', subCategory: 'Horas Extras Veh.', label: 'normal', cantidad: 0, pvp: 0 },
  { id: 'horasExtrasVehFestiva', category: 'EXTRAS', subCategory: 'Horas Extras Veh.', label: 'festiva', cantidad: 0, pvp: 0 },
  
  { id: 'horasExtrasAcNormal', category: 'EXTRAS', subCategory: 'Horas Extras AC', label: 'normal', cantidad: 0, pvp: 0 },
  { id: 'horasExtrasAcFestiva', category: 'EXTRAS', subCategory: 'Horas Extras AC', label: 'festiva', cantidad: 0, pvp: 0 },
  
  { id: 'km', category: 'EXTRAS', label: 'KM', cantidad: 0, pvp: 0 },
  
  // COLCHONETA
  { id: 'colchonetaElectrov', category: 'COLCHONETA', label: 'COLCHONETA + ELECTROV', cantidad: 0, pvp: 0 },
  { id: 'colchoneta', category: 'COLCHONETA', label: 'COLCHONETA', cantidad: 0, pvp: 0 },
  
  // PERSONAL
  { id: 'coordinador', category: 'PERSONAL', label: 'COORDINADOR', cantidad: 0, pvp: 0 },
  { id: 'responsableCentro', category: 'PERSONAL', label: 'RESPONSABLE CENTRO', cantidad: 0, pvp: 0 },
  
  // FIJO MENSUAL SERVICIO PREPARACIÓN
  { id: 'horaPicker', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA PICKER', cantidad: 0, pvp: 0 },
  { id: 'horaExtraPrep', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA EXTRA', cantidad: 0, pvp: 0 },
  { id: 'horaExtraFestivaPrep', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA EXTRA FESTIVA', cantidad: 0, pvp: 0 },
  { id: 'horaNocturnaPrep', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA NOCTURNA', cantidad: 0, pvp: 0 },
  { id: 'horaExtraNocturnaFestivaPrep', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA EXTRA NOCTURNA/FESTIVA', cantidad: 0, pvp: 0 },
  { id: 'horaExtraResponsable', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA EXTRA RESPONSABLE', cantidad: 0, pvp: 0 },
  { id: 'horaExtraResponsableFestiva', category: 'FIJO MENSUAL SERVICIO PREPARACIÓN', label: 'HORA EXTRA RESPONSABLE festiva', cantidad: 0, pvp: 0 },
];

export default function CompanyInvoiceDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  
  const [rows, setRows] = useState<InvoiceRow[]>(JSON.parse(JSON.stringify(INITIAL_ROWS)));
  const [gasoilBase, setGasoilBase] = useState<number>(0);
  const [gasoilEvolucion, setGasoilEvolucion] = useState<number>(1.10);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || profile?.role !== 'superadmin') return;
      
      try {
        setLoading(true);
        let invData: any = null;
        let cId: string | null = null;
        
        if (id === 'new') {
          cId = searchParams.get('companyId');
          const period = searchParams.get('period');
          if (!cId || !period) throw new Error('Faltan parámetros para nueva factura');
          
          const compDoc = await getDoc(doc(db, 'users', cId));
          const compData = compDoc.data();
          
          invData = {
            companyId: cId,
            companyName: compData?.companyName || `${compData?.firstName} ${compData?.lastName}`,
            period: period,
            status: 'draft'
          };
          setInvoice(invData);
        } else {
          const invDoc = await getDoc(doc(db, 'company_invoices', id));
          if (!invDoc.exists()) throw new Error('Invoice not found');
          invData = invDoc.data();
          setInvoice({ id: invDoc.id, ...invData });
          cId = invData.companyId;
        }

        // Fetch company document for flat providerPricingDefaults
        const compDoc = await getDoc(doc(db, 'users', cId!));
        const providerDefaults = compDoc.data()?.providerPricingDefaults || {};

        // Fetch company drivers to filter routes
        const uQ = query(collection(db, 'users'));
        const uSnap = await getDocs(uQ);
        const compDrivers = uSnap.docs.map(d => ({id: d.id, ...d.data()})).filter((u: any) => u.companyId === cId || u.id === cId);
        const driverIds = compDrivers.map(d => d.id);

        // Fetch Routes
        const [year, month] = invData.period.split('-');
        const periodDate = new Date(Number(year), Number(month) - 1, 1);
        const start = startOfMonth(periodDate);
        const end = endOfMonth(periodDate);
        
        const routesQ = query(collection(db, 'routes'), where('status', '==', 'completed'));
        const routesSnap = await getDocs(routesQ);
        
        let totalRoutes = 0;
        let totalKm = 0;
        
        routesSnap.docs.forEach(d => {
          const r = d.data();
          if (driverIds.includes(r.driverId)) {
            if (!r.endTime) return;
            const rt = r.endTime.toDate ? r.endTime.toDate() : new Date(r.endTime);
            if (rt >= start && rt <= end) {
              totalRoutes++;
              totalKm += ((Number(r.endKm) || 0) - (Number(r.startKm) || 0));
            }
          }
        });

        // Merge data into rows
        const currentRows = [...rows];
        
        currentRows.forEach(row => {
          if (invData.rowsData && invData.rowsData[row.id]) {
            row.cantidad = invData.rowsData[row.id].cantidad;
            row.pvp = invData.rowsData[row.id].pvp;
          } else {
            // Apply provider flat default PVP
            if (providerDefaults[row.id]) {
              row.pvp = providerDefaults[row.id].pvp;
            }
            // Auto calculate some quantities based on routes
            if (row.id === 'km') {
              row.cantidad = totalKm;
            } else if (row.id === 'vehicGas') {
              row.cantidad = Math.ceil(totalRoutes / 20); // Dummy calc
            }
          }
        });

        if (invData.gasoil) {
          setGasoilBase(invData.gasoil.base || 0);
          setGasoilEvolucion(invData.gasoil.evolucion || 1.10);
        } else if (providerDefaults['gasoil']) {
          setGasoilBase(providerDefaults['gasoil'].base || 0);
          setGasoilEvolucion(providerDefaults['gasoil'].evolucion || 1.10);
        }
        
        setRows(currentRows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, profile]);

  const updateRow = (id: string, field: 'cantidad' | 'pvp', value: string) => {
    const num = value === '' ? 0 : Number(value);
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: num } : r));
  };

  const getSubtotal = (categoryIds: string[]) => {
    return rows
      .filter(r => categoryIds.includes(r.id))
      .reduce((a, r) => a + (r.cantidad * r.pvp), 0);
  };

  const categoriesTransporte = [
    'vehicGas', 'vehicGasMixto', 'furgoGas', 'vehFaltantes', 'acFijo',
    'festivosFijoDiaEnt', 'festivosFijoAc',
    'jornada100', 'jornadaEspecial', 'jornada50', 'jornadaAc',
    'festivosNoFijoDiaEnt', 'festivosNoFijoAc',
    'horasExtrasVehNormal', 'horasExtrasVehFestiva',
    'horasExtrasAcNormal', 'horasExtrasAcFestiva',
    'km', 'colchonetaElectrov', 'colchoneta',
    'coordinador', 'responsableCentro'
  ];
  
  const categoriesPreparacion = [
    'horaPicker', 'horaExtraPrep', 'horaExtraFestivaPrep', 'horaNocturnaPrep',
    'horaExtraNocturnaFestivaPrep', 'horaExtraResponsable', 'horaExtraResponsableFestiva'
  ];

  const subtotalTransporte = getSubtotal(categoriesTransporte);
  const subtotalPreparacion = getSubtotal(categoriesPreparacion);
  const gasoilEvolTotal = gasoilBase * (gasoilEvolucion / 100);
  const grandTotal = subtotalTransporte + subtotalPreparacion + gasoilBase + gasoilEvolTotal;

  const handleSave = async () => {
    if (!id || !invoice) return;
    setSaving(true);
    try {
      const rowsData = rows.reduce((acc, r) => ({ ...acc, [r.id]: { cantidad: r.cantidad, pvp: r.pvp } }), {});
      const gasoilData = { base: gasoilBase, evolucion: gasoilEvolucion };

      // Update or Create invoice document
      if (id === 'new') {
        await addDoc(collection(db, 'company_invoices'), {
          companyId: invoice.companyId,
          companyName: invoice.companyName,
          period: invoice.period,
          rowsData,
          gasoil: gasoilData,
          totalFactura: grandTotal,
          status: 'saved',
          updatedAt: new Date(),
          generatedAt: new Date(),
          generatedBy: profile.uid,
        });
      } else {
        await updateDoc(doc(db, 'company_invoices', id), {
          rowsData,
          gasoil: gasoilData,
          totalFactura: grandTotal,
          status: 'saved',
          updatedAt: new Date()
        });
      }

      // Update company profile with these provider flat pricing defaults
      const defaults = rows.reduce((acc, r) => ({ ...acc, [r.id]: { pvp: r.pvp } }), {});
      
      await updateDoc(doc(db, 'users', invoice.companyId), {
        providerPricingDefaults: {
          ...defaults,
          gasoil: { base: gasoilBase, evolucion: gasoilEvolucion }
        }
      });

      alert('Pago a proveedor consolidado guardado correctamente.');
      navigate(`/manager/invoices`);
    } catch (err) {
      console.error(err);
      alert('Error guardando pago a proveedor');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'superadmin') {
    return (
      <div className="p-8 text-center text-white/50">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No tienes permisos.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-white/20">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Cargando Factura Consolidada de Proveedor...</p>
      </div>
    );
  }

  const renderRow = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return null;
    return (
      <div key={row.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 transition-colors rounded-lg">
        <span className="text-xs font-bold text-white/80 w-1/3 truncate" title={row.label}>{row.label}</span>
        <div className="flex items-center gap-2 justify-end">
          <input 
            type="number" step="0.01" 
            value={row.cantidad || ''} 
            onChange={(e) => updateRow(row.id, 'cantidad', e.target.value)}
            placeholder="Cant"
            className="w-16 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-right text-xs focus:border-emerald-500 outline-none transition-colors"
          />
          <span className="text-white/20 text-[10px]">×</span>
          <input 
            type="number" step="0.01" 
            value={row.pvp || ''} 
            onChange={(e) => updateRow(row.id, 'pvp', e.target.value)}
            placeholder="PVP"
            className="w-16 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-right text-xs focus:border-emerald-500 outline-none transition-colors"
          />
          <span className="text-white/20 text-[10px]">=</span>
          <span className="w-16 text-right font-mono text-sm font-bold text-emerald-400">
            {(row.cantidad * row.pvp).toFixed(2)}€
          </span>
        </div>
      </div>
    );
  };

  const SectionCard = ({ title, colorClass, children }: { title: string, colorClass: string, children: React.ReactNode }) => (
    <div className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-xl">
      <div className={`px-5 py-3 ${colorClass} border-b border-white/10 flex justify-between items-center`}>
        <h3 className="font-bold text-sm tracking-widest uppercase">{title}</h3>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-start">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-40">
      <Helmet>
        <title>Pago a Proveedor Consolidado - BTS Logistics</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/manager/invoices`)} className="flex items-center text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a Proveedores
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Pago Consolidado
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-6 flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Periodo</p>
            <h2 className="text-2xl font-bold text-white">{invoice?.period}</h2>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-6 flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Proveedor (Consolidado)</p>
            <h2 className="text-2xl font-bold text-emerald-400 truncate">{invoice?.companyName}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-6 gap-y-8">
        {/* ================= TRANSPORTE ================= */}
        <div className="col-span-full border-b border-white/10 pb-4 mt-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Transporte</h2>
            <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Costes operativos de rutas y vehículos</p>
          </div>
          <div className="text-left md:text-right bg-blue-500/10 px-6 py-3 rounded-2xl border border-blue-500/20">
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Subtotal Transporte</p>
            <p className="text-3xl font-black text-white font-mono">{subtotalTransporte.toFixed(2)}€</p>
          </div>
        </div>

        <SectionCard title="Servicio Fijo" colorClass="bg-blue-500/10 text-blue-400">
          {renderRow('vehicGas')}
          {renderRow('vehicGasMixto')}
          {renderRow('furgoGas')}
          {renderRow('vehFaltantes')}
          {renderRow('acFijo')}
        </SectionCard>

        <SectionCard title="Festivos & Colchoneta" colorClass="bg-orange-500/10 text-orange-400">
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Festivos Vehículo Fijo</p>
          {renderRow('festivosFijoDiaEnt')}
          {renderRow('festivosFijoAc')}
          
          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Festivos Vehículo No Fijo</p>
          {renderRow('festivosNoFijoDiaEnt')}
          {renderRow('festivosNoFijoAc')}

          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Colchoneta / Electrov</p>
          {renderRow('colchonetaElectrov')}
          {renderRow('colchoneta')}
        </SectionCard>

        <SectionCard title="Extras" colorClass="bg-red-500/10 text-red-400">
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Jornadas</p>
          {renderRow('jornada100')}
          {renderRow('jornadaEspecial')}
          {renderRow('jornada50')}
          {renderRow('jornadaAc')}
          
          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Horas Extras Veh.</p>
          {renderRow('horasExtrasVehNormal')}
          {renderRow('horasExtrasVehFestiva')}
          
          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Horas Extras AC & KM</p>
          {renderRow('horasExtrasAcNormal')}
          {renderRow('horasExtrasAcFestiva')}
          {renderRow('km')}
        </SectionCard>

        {/* ================= CONSOLIDACION ENTREGAS ================= */}
        <div className="col-span-full border-b border-white/10 pb-4 mt-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Consolidación Entregas</h2>
            <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Fijo Mensual Servicio Preparación</p>
          </div>
          <div className="text-left md:text-right bg-amber-500/10 px-6 py-3 rounded-2xl border border-amber-500/20">
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1">Subtotal Preparación</p>
            <p className="text-3xl font-black text-white font-mono">{subtotalPreparacion.toFixed(2)}€</p>
          </div>
        </div>

        <SectionCard title="Preparación Base" colorClass="bg-amber-500/10 text-amber-400">
          {renderRow('horaPicker')}
          {renderRow('horaExtraPrep')}
          {renderRow('horaExtraFestivaPrep')}
          {renderRow('horaNocturnaPrep')}
          {renderRow('horaExtraNocturnaFestivaPrep')}
        </SectionCard>

        <SectionCard title="Responsables" colorClass="bg-purple-500/10 text-purple-400">
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Preparación</p>
          {renderRow('horaExtraResponsable')}
          {renderRow('horaExtraResponsableFestiva')}

          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] font-bold text-white/30 uppercase mt-2 mb-1">Personal Centro</p>
          {renderRow('coordinador')}
          {renderRow('responsableCentro')}
        </SectionCard>

        {/* ================= GAS-OIL ================= */}
        <SectionCard title="Gas-oil" colorClass="bg-yellow-500/10 text-yellow-400">
          <div className="flex items-center justify-between gap-2 py-3 border-b border-white/5">
            <span className="text-xs font-bold text-white/80">Gas-oil Base</span>
            <div className="flex items-center gap-2">
              <input 
                type="number" step="0.01" 
                value={gasoilBase || ''} 
                onChange={(e) => setGasoilBase(Number(e.target.value))}
                placeholder="Total Base"
                className="w-24 bg-slate-900/50 border border-white/10 rounded px-2 py-1 text-right text-xs focus:border-yellow-500 outline-none"
              />
              <span className="text-white/20 text-[10px]">=</span>
              <span className="w-16 text-right font-mono text-sm font-bold text-white">
                {gasoilBase.toFixed(2)}€
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 py-3">
            <span className="text-xs font-bold text-white/80">Evolución Gas-oil</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input 
                  type="number" step="0.01" 
                  value={gasoilEvolucion || ''} 
                  onChange={(e) => setGasoilEvolucion(Number(e.target.value))}
                  className="w-20 bg-slate-900/50 border border-white/10 rounded px-2 py-1 pr-6 text-right text-xs focus:border-yellow-500 outline-none"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">%</span>
              </div>
              <span className="text-white/20 text-[10px]">=</span>
              <span className="w-16 text-right font-mono text-sm font-bold text-white">
                {gasoilEvolTotal.toFixed(2)}€
              </span>
            </div>
          </div>
          
          <div className="mt-auto pt-4 flex justify-between items-end border-t border-white/10">
            <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">Total Gas-oil</span>
            <span className="font-mono font-bold text-xl text-yellow-400">{(gasoilBase + gasoilEvolTotal).toFixed(2)}€</span>
          </div>
        </SectionCard>
      </div>

      {/* Floating Footer Total */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-6 glass border-t border-white/10 flex justify-end items-center z-50">
        <div className="bg-emerald-500/10 px-8 py-3 rounded-2xl border border-emerald-500/20 flex items-center gap-6 shadow-2xl">
          <div className="text-right">
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Total a Pagar a Proveedor</p>
            <p className="text-4xl lg:text-5xl font-black text-white font-mono">{grandTotal.toFixed(2)}€</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all h-full"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span className="hidden sm:inline">Guardar Pago</span>
          </button>
        </div>
      </div>
    </div>
  );
}
