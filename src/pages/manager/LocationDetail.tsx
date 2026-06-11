import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  MapPin, Clock, Euro, Calendar, AlertCircle, 
  ChevronLeft, Check, Loader2, Plus, Trash2 
} from 'lucide-react';

type TimeRate = {
  id: string;
  start: string;
  end: string;
  rate: number;
};

const EMPTY_FORM = { 
  name: '', 
  address: '', 
  postalCode: '', 
  region: '', 
  schedule: '', 
  type: 'logistic_center', 
  lat: '', 
  lng: '',
  openingTime: '08:00',
  closingTime: '20:00',
  is24h: false,
  timeRates: [] as TimeRate[]
};

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'rates'>('general');

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchLocation = async () => {
        try {
          const snap = await getDoc(doc(db, 'locations', id));
          if (snap.exists()) {
            const data = snap.data();
            setFormData({
              name: data.name || '',
              address: data.address || '',
              postalCode: data.postalCode || '',
              region: data.region || '',
              schedule: data.schedule || '',
              type: data.type || 'logistic_center',
              lat: data.lat || '',
              lng: data.lng || '',
              openingTime: data.openingTime || '08:00',
              closingTime: data.closingTime || '20:00',
              is24h: data.is24h || false,
              timeRates: data.timeRates || []
            });
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
      const dataToSave = {
        ...formData,
        lat: formData.lat !== '' ? Number(formData.lat) : null,
        lng: formData.lng !== '' ? Number(formData.lng) : null,
        updatedAt: serverTimestamp()
      };

      if (id && id !== 'new') {
        await updateDoc(doc(db, 'locations', id), dataToSave);
      } else {
        await addDoc(collection(db, 'locations'), { 
          ...dataToSave, 
          createdAt: serverTimestamp() 
        });
      }
      navigate('/manager/locations');
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
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar Centro
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-white/[0.02] px-6">
          {[
            { id: 'general', label: 'General', icon: MapPin },
            { id: 'schedule', label: 'Horario', icon: Clock },
            { id: 'rates', label: 'Tarifas Nocturnas', icon: Euro },
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
          <form onSubmit={handleSubmit} className="space-y-8">
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
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" /> Disponibilidad Horaria
                    </h3>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <span className="text-[10px] font-bold text-white/40 uppercase group-hover:text-white/60 transition-colors">Abierto 24 Horas</span>
                      <div 
                        onClick={() => setFormData({ ...formData, is24h: !formData.is24h })}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.is24h ? 'bg-blue-600' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md ${formData.is24h ? 'left-7' : 'left-1'}`} />
                      </div>
                    </label>
                  </div>

                  {!formData.is24h ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Hora de Apertura</label>
                        <input
                          type="time"
                          value={formData.openingTime}
                          onChange={e => setFormData({ ...formData, openingTime: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-1">Hora de Cierre</label>
                        <input
                          type="time"
                          value={formData.closingTime}
                          onChange={e => setFormData({ ...formData, closingTime: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Este centro opera ininterrumpidamente</p>
                    </div>
                  )}
                  
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-300 leading-relaxed font-medium">
                      El horario configurado influye en la detección de disponibilidad para los conductores en tiempo real.
                    </p>
                  </div>
                </div>
                
                {field('Resumen de Horario (Texto)', 'schedule', 'Ej. Lunes a Viernes de 07:00 a 19:00', true)}
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
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 min-w-[200px]"
        >
          {saving ? 'Guardando...' : 'Finalizar Configuración'}
        </button>
      </div>
    </div>
  );
}
