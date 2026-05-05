import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Send, Loader2, Phone } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';

const EMERGENCY_REASONS = [
  'Avería Mecánica',
  'Accidente de Tráfico',
  'Problema de Salud',
  'Retraso Grave',
  'Otro'
];

export default function Emergency() {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setLoading(true);

    try {
      // Get location for emergency
      let location = null;
      if (navigator.geolocation) {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }

      await addDoc(collection(db, 'emergencies'), {
        driverId: user.uid,
        driverName: profile?.firstName ? `${profile.firstName} ${profile.lastName}` : (user.name || user.displayName || 'Conductor'),
        companyId: profile?.companyId || null,
        timestamp: serverTimestamp(),
        reason,
        description,
        location,
        status: 'active'
      });

      alert('Emergencia enviada. El Centro de Control ha sido notificado.');
      navigate('/driver/start');
    } catch (err) {
      console.error(err);
      alert('Error al enviar alerta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="glass p-6 rounded-3xl border-red-500/30">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-red-600/40 animate-pulse">
            <AlertTriangle className="text-white w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-red-500">ALERTA DE EMERGENCIA</h2>
          <p className="text-gray-400 mt-1">Notifica inmediatamente al Centro de Control</p>
        </div>

        <form onSubmit={handleSend} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Motivo</label>
            <div className="grid grid-cols-1 gap-2">
              {EMERGENCY_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    reason === r 
                      ? 'bg-red-600 border-red-500 text-white shadow-lg' 
                      : 'bg-slate-800/30 border-gray-700 text-gray-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Descripción (Opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[100px]"
              placeholder="Explica brevemente lo ocurrido..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || !reason}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 text-lg"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <Send className="w-5 h-5" />
                ENVIAR ALERTA
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-sm text-gray-500 mb-4">O llama directamente</p>
          <a 
            href="tel:+34900000000"
            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors"
          >
            <Phone className="w-5 h-5 text-green-500" />
            Llamar a Control
          </a>
        </div>
      </div>
    </div>
  );
}
