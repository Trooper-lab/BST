import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  MapPin, Clock, Euro, AlertCircle,
  ChevronLeft, Check, Loader2, Plus, Trash2, FileText
} from 'lucide-react';

const INVOICE_PRICE_ROWS = [
  { id: 'vehicGas',          label: 'VEHÍC. GAS',                       group: 'Servicio Fijo' },
  { id: 'vehicGasMixto',     label: 'VEH.GAS-MIXTO',                    group: 'Servicio Fijo' },
  { id: 'furgoGas',          label: 'FURGO GAS',                        group: 'Servicio Fijo' },
  { id: 'vehFaltantes',      label: 'VEH.FALTANTES',                    group: 'Servicio Fijo' },
  { id: 'acFijo',            label: 'AC FIJO',                          group: 'Servicio Fijo' },
  { id: 'festivosFijoDiaEnt', label: 'FESTIVO FIJO - DIA-ENT.',         group: 'Festivos' },
  { id: 'festivosFijoAc',    label: 'FESTIVO FIJO - AC',                group: 'Festivos' },
  { id: 'jornada100',        label: 'JORNADA 100%',                     group: 'Extras / Jornadas' },
  { id: 'jornadaEspecial',   label: 'JORNADA ESPECIAL',                 group: 'Extras / Jornadas' },
  { id: 'jornada50',         label: 'JORNADA 50%',                      group: 'Extras / Jornadas' },
  { id: 'jornadaAc',         label: 'JORNADA AC',                       group: 'Extras / Jornadas' },
  { id: 'festivosNoFijoDiaEnt', label: 'FESTIVO NO FIJO - DIA-ENT.',    group: 'Extras / Festivos No Fijo' },
  { id: 'festivosNoFijoAc',  label: 'FESTIVO NO FIJO - AC',             group: 'Extras / Festivos No Fijo' },
  { id: 'horasExtrasVehNormal',  label: 'H.EXTRA VEH. normal',          group: 'Horas Extra' },
  { id: 'horasExtrasVehFestiva', label: 'H.EXTRA VEH. festiva',         group: 'Horas Extra' },
  { id: 'horasExtrasAcNormal',   label: 'H.EXTRA AC normal',            group: 'Horas Extra' },
  { id: 'horasExtrasAcFestiva',  label: 'H.EXTRA AC festiva',           group: 'Horas Extra' },
  { id: 'km',                label: 'KM',                               group: 'Horas Extra' },
  { id: 'colchonetaElectrov', label: 'COLCHONETA + ELECTROV',           group: 'Colchoneta' },
  { id: 'colchoneta',        label: 'COLCHONETA',                       group: 'Colchoneta' },
  { id: 'coordinador',       label: 'COORDINADOR',                      group: 'Personal' },
  { id: 'responsableCentro', label: 'RESPONSABLE CENTRO',               group: 'Personal' },
  { id: 'horaPicker',        label: 'HORA PICKER',                      group: 'Preparación' },
  { id: 'horaExtraPrep',     label: 'HORA EXTRA (prep.)',               group: 'Preparación' },
  { id: 'horaExtraFestivaPrep', label: 'HORA EXTRA FESTIVA (prep.)',    group: 'Preparación' },
  { id: 'horaNocturnaPrep',  label: 'HORA NOCTURNA',                    group: 'Preparación' },
  { id: 'horaExtraNocturnaFestivaPrep', label: 'H.EXTRA NOCTURNA/FEST.', group: 'Preparación' },
  { id: 'horaExtraResponsable',        label: 'H.EXTRA RESPONSABLE',    group: 'Preparación' },
  { id: 'horaExtraResponsableFestiva', label: 'H.EXTRA RESP. FESTIVA',  group: 'Preparación' },
];

type TimeRate = {
  id: string;
  start: string;
  end: string;
  rate: number;
};

type DaySchedule = { open: boolean; openingTime: string; closingTime: string };

const DAYS: { key: string; short: string; label: string; weekday: boolean }[] = [
  { key: 'lunes',     short: 'Lun', label: 'Lunes',      weekday: true  },
  { key: 'martes',    short: 'Mar', label: 'Martes',     weekday: true  },
  { key: 'miercoles', short: 'Mié', label: 'Miércoles',  weekday: true  },
  { key: 'jueves',    short: 'Jue', label: 'Jueves',     weekday: true  },
  { key: 'viernes',   short: 'Vie', label: 'Viernes',    weekday: true  },
  { key: 'sabado',    short: 'Sáb', label: 'Sábado',     weekday: false },
  { key: 'domingo',   short: 'Dom', label: 'Domingo',    weekday: false },
];

const defaultDay = (open: boolean): DaySchedule => ({ open, openingTime: '08:00', closingTime: '20:00' });

const DEFAULT_WEEKLY: Record<string, DaySchedule> = {
  lunes:     defaultDay(true),
  martes:    defaultDay(true),
  miercoles: defaultDay(true),
  jueves:    defaultDay(true),
  viernes:   defaultDay(true),
  sabado:    defaultDay(false),
  domingo:   defaultDay(false),
};

const EMPTY_FORM = {
  name: '',
  address: '',
  postalCode: '',
  region: '',
  type: 'logistic_center',
  lat: '',
  lng: '',
  is24h: false,
  weeklySchedule: DEFAULT_WEEKLY as Record<string, DaySchedule>,
  timeRates: [] as TimeRate[],
};

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [invoiceDefaults, setInvoiceDefaults] = useState<Record<string, number>>({});
  const [gasoilBase, setGasoilBase] = useState(0);
  const [gasoilEvolucion, setGasoilEvolucion] = useState(1.10);
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'rates' | 'pricing'>('general');

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchLocation = async () => {
        try {
          const snap = await getDoc(doc(db, 'locations', id));
          if (snap.exists()) {
            const data = snap.data();
            // Migrate old single openingTime/closingTime to weeklySchedule
            let weeklySchedule: Record<string, DaySchedule> = data.weeklySchedule || {};
            if (!data.weeklySchedule) {
              const oldOpen = data.openingTime || '08:00';
              const oldClose = data.closingTime || '20:00';
              weeklySchedule = {
                lunes:     { open: true,  openingTime: oldOpen, closingTime: oldClose },
                martes:    { open: true,  openingTime: oldOpen, closingTime: oldClose },
                miercoles: { open: true,  openingTime: oldOpen, closingTime: oldClose },
                jueves:    { open: true,  openingTime: oldOpen, closingTime: oldClose },
                viernes:   { open: true,  openingTime: oldOpen, closingTime: oldClose },
                sabado:    { open: false, openingTime: oldOpen, closingTime: oldClose },
                domingo:   { open: false, openingTime: oldOpen, closingTime: oldClose },
              };
            }
            setFormData({
              name: data.name || '',
              address: data.address || '',
              postalCode: data.postalCode || '',
              region: data.region || '',
              type: data.type || 'logistic_center',
              lat: data.lat || '',
              lng: data.lng || '',
              is24h: data.is24h || false,
              weeklySchedule,
              timeRates: data.timeRates || [],
            });
            const defs = data.invoiceDefaults || {};
            const pvpMap: Record<string, number> = {};
            INVOICE_PRICE_ROWS.forEach(r => { pvpMap[r.id] = defs[r.id]?.pvp || 0; });
            setInvoiceDefaults(pvpMap);
            setGasoilBase(defs.gasoil?.base || 0);
            setGasoilEvolucion(defs.gasoil?.evolucion || 1.10);
          }
        } catch (err) {
          console.error('Error fetching location:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchLocation();
    }
  }, [id]);

  const addTimeRate = () => {
    const newRate: TimeRate = {
      id: Math.random().toString(36).substr(2, 9),
      start: '22:00',
      end: '06:00',
      rate: 15.0
    };
    setFormData({ ...formData, timeRates: [...formData.timeRates, newRate] });
  };

  const removeTimeRate = (rateId: string) => {
    setFormData({ ...formData, timeRates: formData.timeRates.filter(r => r.id !== rateId) });
  };

  const updateTimeRate = (rateId: string, updates: Partial<TimeRate>) => {
    setFormData({
      ...formData,
      timeRates: formData.timeRates.map(r => r.id === rateId ? { ...r, ...updates } : r)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const invoiceDefaultsToSave: Record<string, any> = {};
      INVOICE_PRICE_ROWS.forEach(r => {
        invoiceDefaultsToSave[r.id] = { pvp: invoiceDefaults[r.id] || 0 };
      });
      invoiceDefaultsToSave.gasoil = { base: gasoilBase, evolucion: gasoilEvolucion };

      const dataToSave = {
        ...formData,
        lat: formData.lat !== '' ? Number(formData.lat) : null,
        lng: formData.lng !== '' ? Number(formData.lng) : null,
        invoiceDefaults: invoiceDefaultsToSave,
        // Derive closingTime for the week's most representative day (Mon–Fri) for legacy callers
        closingTime: formData.weeklySchedule.viernes?.closingTime ?? formData.weeklySchedule.lunes?.closingTime ?? '20:00',
        updatedAt: serverTimestamp(),
      };

      if (id && id !== 'new') {
        await updateDoc(doc(db, 'locations', id), dataToSave);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        await addDoc(collection(db, 'locations'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
        navigate('/manager/locations');
      }
    } catch (err) {
      console.error('Error saving location:', err);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof EMPTY_FORM, placeholder: string, colSpan = false, textarea = false) => (
    <div className={`space-y-1.5 ${colSpan ? 'col-span-2' : ''}`}>
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">{label}</label>
      {textarea ? (
        <textarea
          required
          rows={3}
          value={formData[key] as string}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none transition-all"
        />
      ) : (
        <input
          required
          type="text"
          value={formData[key] as string}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Helmet>
        <title>BTS Logistics Pro - Detalle del Centro</title>
      </Helmet>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/manager/locations')}
            className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {id === 'new' ? 'Nuevo Centro Logístico' : formData.name}
            </h1>
            <p className="text-white/40 text-sm">
              {id === 'new' ? 'Configure un nuevo punto de carga y descarga' : 'Gestión de detalles y tarifas'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg ${
            saved ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saved ? '¡Guardado!' : 'Guardar Centro'}
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-white/[0.02] px-6">
          {[
            { id: 'general', label: 'General', icon: MapPin },
            { id: 'schedule', label: 'Horario', icon: Clock },
            { id: 'rates', label: 'Tarifas Nocturnas', icon: Euro },
            { id: 'pricing', label: 'Precios Factura', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'border-blue-500 text-blue-400' 
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            {activeTab === 'general' && (
              <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {field('Nombre del Centro', 'name', 'Ej. Makro Leganés', true)}
                {field('Región / Ciudad', 'region', 'Ej. Madrid')}
                {field('Código Postal', 'postalCode', '28914')}
                {field('Dirección Completa', 'address', 'Calle, número, localidad...', true, true)}
                
                <div className="col-span-2 pt-6 border-t border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" /> Geoposicionamiento
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Latitud</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lat}
                        onChange={e => setFormData({ ...formData, lat: e.target.value })}
                        placeholder="40.4167"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Longitud</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lng}
                        onChange={e => setFormData({ ...formData, lng: e.target.value })}
                        placeholder="-3.7033"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* 24h toggle */}
                <div className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-white">Centro 24 Horas</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Opera sin cierre — no se calculan horas extra por cierre</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is24h: !formData.is24h })}
                    className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${formData.is24h ? 'bg-blue-600' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md ${formData.is24h ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {formData.is24h ? (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl">
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">
                      Este centro opera ininterrumpidamente los 7 días
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[120px_52px_1fr_auto] gap-4 items-center px-5 py-3 border-b border-white/5 bg-white/[0.03]">
                      <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">Día</span>
                      <span className="text-[9px] font-black text-white/25 uppercase tracking-widest text-center">Abierto</span>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">Apertura</span>
                        <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">Cierre</span>
                      </div>
                      <span className="text-[9px] font-black text-white/25 uppercase tracking-widest w-16 text-center">Copiar</span>
                    </div>

                    {/* Day rows */}
                    {DAYS.map((day, idx) => {
                      const ds = formData.weeklySchedule[day.key] ?? defaultDay(day.weekday);
                      const updateDay = (patch: Partial<DaySchedule>) =>
                        setFormData({
                          ...formData,
                          weeklySchedule: {
                            ...formData.weeklySchedule,
                            [day.key]: { ...ds, ...patch },
                          },
                        });
                      const applyToWeekdays = () => {
                        const updated = { ...formData.weeklySchedule };
                        DAYS.filter(d => d.weekday).forEach(d => {
                          updated[d.key] = { ...updated[d.key], openingTime: ds.openingTime, closingTime: ds.closingTime };
                        });
                        setFormData({ ...formData, weeklySchedule: updated });
                      };
                      const applyToAll = () => {
                        const updated = { ...formData.weeklySchedule };
                        DAYS.forEach(d => {
                          updated[d.key] = { ...updated[d.key], openingTime: ds.openingTime, closingTime: ds.closingTime };
                        });
                        setFormData({ ...formData, weeklySchedule: updated });
                      };

                      return (
                        <div
                          key={day.key}
                          className={`grid grid-cols-[120px_52px_1fr_auto] gap-4 items-center px-5 py-3.5 transition-colors ${
                            idx < DAYS.length - 1 ? 'border-b border-white/5' : ''
                          } ${ds.open ? 'hover:bg-white/[0.02]' : 'opacity-60'}`}
                        >
                          {/* Day name */}
                          <div>
                            <p className="text-sm font-bold text-white">{day.label}</p>
                          </div>

                          {/* Open toggle */}
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => updateDay({ open: !ds.open })}
                              className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${ds.open ? 'bg-blue-600' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${ds.open ? 'left-5' : 'left-0.5'}`} />
                            </button>
                          </div>

                          {/* Time inputs or closed label */}
                          {ds.open ? (
                            <div className="grid grid-cols-2 gap-4">
                              <input
                                type="time"
                                value={ds.openingTime}
                                onChange={e => updateDay({ openingTime: e.target.value })}
                                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                              />
                              <input
                                type="time"
                                value={ds.closingTime}
                                onChange={e => updateDay({ closingTime: e.target.value })}
                                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <span className="text-xs font-bold text-red-400/50 uppercase tracking-widest">Cerrado</span>
                            </div>
                          )}

                          {/* Copy shortcuts */}
                          <div className="flex gap-1 w-16 justify-end">
                            {ds.open && (
                              <>
                                <button
                                  type="button"
                                  title="Copiar horario a Lunes–Viernes"
                                  onClick={applyToWeekdays}
                                  className="text-[9px] font-black text-white/20 hover:text-blue-400 px-1.5 py-1 rounded-lg hover:bg-blue-500/10 transition-all uppercase tracking-wide"
                                >
                                  L–V
                                </button>
                                <button
                                  type="button"
                                  title="Copiar horario a todos los días"
                                  onClick={applyToAll}
                                  className="text-[9px] font-black text-white/20 hover:text-blue-400 px-1.5 py-1 rounded-lg hover:bg-blue-500/10 transition-all uppercase tracking-wide"
                                >
                                  7d
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    El cierre de cada día se usa para calcular horas extra cuando un conductor finaliza su jornada después de esa hora.
                    Los días marcados como cerrado usan el umbral de horas configurado en el perfil del conductor.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'rates' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Euro className="w-4 h-4 text-emerald-400" /> Tarifas Especiales por Tramo
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Configure pagos premium para horarios específicos</p>
                  </div>
                  <button
                    type="button"
                    onClick={addTimeRate}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" /> Añadir Tramo
                  </button>
                </div>

                <div className="grid gap-4">
                  {formData.timeRates.map(tr => (
                    <div key={tr.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-end gap-6 group relative hover:bg-white/[0.07] transition-all">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Hora Inicio</label>
                        <input
                          type="time"
                          value={tr.start}
                          onChange={e => updateTimeRate(tr.id, { start: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Hora Fin</label>
                        <input
                          type="time"
                          value={tr.end}
                          onChange={e => updateTimeRate(tr.id, { end: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Tarifa (€/Hora Extra)</label>
                        <div className="relative">
                          <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500/50" />
                          <input
                            type="number"
                            step="0.1"
                            value={tr.rate}
                            onChange={e => updateTimeRate(tr.id, { rate: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTimeRate(tr.id)}
                        className="p-3 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all mb-0.5"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {formData.timeRates.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-white/5 rounded-[2rem] text-center bg-white/[0.01]">
                      <Euro className="w-8 h-8 text-white/5 mx-auto mb-3" />
                      <p className="text-sm text-white/20 italic">No hay tarifas especiales configuradas</p>
                      <button 
                        type="button"
                        onClick={addTimeRate}
                        className="mt-4 text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest"
                      >
                        Definir primera tarifa nocturna
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-blue-400" /> Precios por Defecto de Factura
                  </h3>
                  <p className="text-xs text-white/40">Estos precios se pre-rellenarán automáticamente al generar una factura para este centro.</p>
                </div>

                {/* Group rows by category */}
                {Array.from(new Set(INVOICE_PRICE_ROWS.map(r => r.group))).map(group => (
                  <div key={group} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">{group}</p>
                    {INVOICE_PRICE_ROWS.filter(r => r.group === group).map(row => (
                      <div key={row.id} className="flex items-center justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-xs font-bold text-white/70 flex-1">{row.label}</span>
                        <div className="relative w-28">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-emerald-500/50" />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={invoiceDefaults[row.id] || ''}
                            onChange={e => setInvoiceDefaults(prev => ({ ...prev, [row.id]: Number(e.target.value) }))}
                            placeholder="0.00"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-right text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Gas-oil defaults */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Gas-oil</p>
                  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-white/5">
                    <span className="text-xs font-bold text-white/70 flex-1">Base Gas-oil (€ total)</span>
                    <div className="relative w-28">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-500/50" />
                      <input
                        type="number" step="0.01" min="0"
                        value={gasoilBase || ''}
                        onChange={e => setGasoilBase(Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-right text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-1.5">
                    <span className="text-xs font-bold text-white/70 flex-1">Evolución Gas-oil (%)</span>
                    <div className="relative w-28">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">%</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={gasoilEvolucion || ''}
                        onChange={e => setGasoilEvolucion(Number(e.target.value))}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 pr-8 py-2 text-right text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Estos precios se guardan junto al centro. Al generar una factura nueva para este centro, las cantidades se calcularán automáticamente de las rutas y los precios se tomarán de aquí.
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/manager/locations')}
          className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold transition-all"
        >
          Descartar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`px-8 py-3 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all shadow-lg min-w-[200px] ${
            saved ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
          }`}
        >
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
