import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  User, Mail, CreditCard, Truck, 
  Check, Loader2, AlertCircle, Save
} from 'lucide-react';

const VEHICLE_TYPES = [
  { value: 'van_small',    label: 'Furgoneta <3.5t' },
  { value: 'van_large',    label: 'Furgoneta 3.5t' },
  { value: 'truck_medium', label: 'Camión 7.5t' },
  { value: 'truck_large',  label: 'Camión >7.5t' },
];

export default function UserProfile() {
  const { user, profile, setProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    vehicleType: '',
    vehiclePlate: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        dni: profile.dni || '',
        vehicleType: profile.vehicleType || '',
        vehiclePlate: profile.vehiclePlate || '',
      });
      setLoading(false);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      setProfile({ ...profile, ...formData });
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: 'Error al actualizar el perfil' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-gray-400 italic">Cargando tu perfil...</p>
      </div>
    );
  }

  const inputCls = "w-full bg-slate-800/50 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/40 outline-none transition-all";

  return (
    <div className="max-w-md mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mi Perfil</h1>
          <p className="text-gray-400 text-sm">Gestiona tus datos personales</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <User className="w-3 h-3" /> Datos Personales
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre</label>
              <input 
                className={inputCls} 
                value={formData.firstName} 
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Nombre"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Apellidos</label>
              <input 
                className={inputCls} 
                value={formData.lastName} 
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Apellidos"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">DNI / NIE</label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                className={`${inputCls} pl-11`}
                value={formData.dni} 
                onChange={e => setFormData({ ...formData, dni: e.target.value.toUpperCase() })}
                placeholder="00000000X"
              />
            </div>
          </div>

          <div className="space-y-1.5 opacity-60">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Email (No editable)</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                className={`${inputCls} pl-11 bg-slate-900/50`}
                value={profile?.email} 
                disabled
              />
            </div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Truck className="w-3 h-3" /> Vehículo Habitual
          </h2>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Tipo de Vehículo</label>
            <select 
              className={inputCls}
              value={formData.vehicleType}
              onChange={e => setFormData({ ...formData, vehicleType: e.target.value })}
            >
              <option value="">Sin asignar</option>
              {VEHICLE_TYPES.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Matrícula</label>
            <input 
              className={inputCls}
              value={formData.vehiclePlate}
              onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
              placeholder="0000 ABC"
            />
          </div>
        </div>

        {/* Status Messages */}
        {message.text && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <button 
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Guardar Cambios
        </button>
      </form>

      {/* Info footer */}
      <p className="text-center text-[10px] text-gray-500 px-8 leading-relaxed">
        Los cambios en tu perfil serán visibles para los gestores de tráfico. 
        Para cambios en tu tarifa o jornada, contacta con administración.
      </p>
    </div>
  );
}
