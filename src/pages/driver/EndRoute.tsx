import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle2, Loader2, Square, CheckCheck } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';

export default function EndRoute() {
  const [kmEnd, setKmEnd] = useState('');
  const [totalDeliveries, setTotalDeliveries] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDestino, setSavingDestino] = useState(false);
  const [destinoSaved, setDestinoSaved] = useState(false);
  const [horasDeclaradas, setHorasDeclaradas] = useState('');
  
  const navigate = useNavigate();
  const { activeRoute, setActiveRoute } = useAuthStore();

  useEffect(() => {
    // If no active route, send back to start
    if (!activeRoute) {
      navigate('/driver/start');
      return;
    }

    // Pre-populate destination if already saved on this route
    if (activeRoute.endCenter) {
      setSelectedCenter(activeRoute.endCenter);
      setDestinoSaved(true);
    }

    // Fetch centers
    const fetchCenters = async () => {
      const q = query(collection(db, 'locations'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      setCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCenters();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("GPS Error:", err)
      );
    }
  }, [activeRoute, navigate]);

  const handleSaveDestino = async () => {
    if (!selectedCenter || !activeRoute) return;
    setSavingDestino(true);
    try {
      await updateDoc(doc(db, 'routes', activeRoute.id), { endCenter: selectedCenter });
      setActiveRoute({ ...activeRoute, endCenter: selectedCenter });
      setDestinoSaved(true);
    } catch (err) {
      console.error(err);
      alert('Error al guardar destino');
    } finally {
      setSavingDestino(false);
    }
  };

  const handleEnd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmEnd || !totalDeliveries || !activeRoute || !selectedCenter) return;
    setLoading(true);

    try {
      let photoUrl = '';
      if (image) {
        const storageRef = ref(storage, `odometers/${activeRoute.driverId}/${Date.now()}_end.jpg`);
        await uploadBytes(storageRef, image);
        photoUrl = await getDownloadURL(storageRef);
      }

      // Fetch driver profile to get hourlyRate
      const driverDoc = await getDoc(doc(db, 'users', activeRoute.driverId));
      const rate = driverDoc.exists() ? (driverDoc.data().hourlyRate || 15) : 15;

      // Use driver-declared hours if provided, otherwise auto-calculate from timestamps
      let autoHours = 0;
      if (activeRoute.startTime) {
        const start = activeRoute.startTime.toDate ? activeRoute.startTime.toDate() : new Date(activeRoute.startTime);
        autoHours = (new Date().getTime() - start.getTime()) / 3600000;
      }
      const billedHours = horasDeclaradas ? Number(horasDeclaradas) : autoHours;
      const totalCost = billedHours * rate;

      const routeRef = doc(db, 'routes', activeRoute.id);
      await updateDoc(routeRef, {
        endTime: serverTimestamp(),
        endKm: Number(kmEnd),
        endLocation: location,
        endCenter: selectedCenter,
        endPhoto: photoUrl,
        totalDeliveries: Number(totalDeliveries),
        submittedHours: horasDeclaradas ? Number(horasDeclaradas) : null,
        autoHours: parseFloat(autoHours.toFixed(4)),
        totalCost: totalCost,
        status: 'completed'
      });

      setActiveRoute(null);
      alert('Jornada finalizada con éxito');
      navigate('/driver/stats');
    } catch (err) {
      console.error(err);
      alert('Error al finalizar ruta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="glass p-6 rounded-3xl">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-400">
          <Square className="w-5 h-5 fill-red-400" />
          Finalizar Reparto
        </h2>

        <form onSubmit={handleEnd} className="space-y-6">
          {/* Destination Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">Punto de Entrega / Retorno</label>
            <select
              value={selectedCenter}
              onChange={(e) => { setSelectedCenter(e.target.value); setDestinoSaved(false); }}
              className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none"
              required
            >
              <option value="" disabled>Selecciona centro...</option>
              {centers.map(center => (
                <option key={center.id} value={center.name}>{center.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveDestino}
              disabled={!selectedCenter || savingDestino || destinoSaved}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-blue-500/40 bg-blue-600/10 text-blue-400 text-sm font-medium hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {savingDestino ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : destinoSaved ? (
                <><CheckCheck className="w-4 h-4 text-green-400" /><span className="text-green-400">Destino guardado</span></>
              ) : (
                'Guardar Destino'
              )}
            </button>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* KM Input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Kilometraje Final</label>
            <div className="relative">
              <input
                type="number"
                value={kmEnd}
                onChange={(e) => setKmEnd(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="00000"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">KM</span>
            </div>
          </div>

          {/* Deliveries Input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Repartos Totales</label>
            <div className="relative">
              <input
                type="number"
                value={totalDeliveries}
                onChange={(e) => setTotalDeliveries(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                placeholder="0"
                required
              />
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          {/* Declared hours */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Horas Trabajadas
              <span className="ml-2 text-[10px] text-gray-600 font-normal">(opcional — se usarán para el cálculo de pago)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={horasDeclaradas}
                onChange={(e) => setHorasDeclaradas(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="0.0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">h</span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-600">
              El sistema también registra las horas automáticamente por timestamps.
            </p>
          </div>

          {/* Photo & GPS */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-gray-700 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-all group">
              <Camera className="w-8 h-8 text-gray-500 mb-2 group-hover:text-blue-400" />
              <span className="text-xs text-gray-500">Foto Final</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="hidden" 
              />
            </label>
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-700 bg-slate-800/30">
              <MapPin className={`w-8 h-8 mb-2 ${location ? 'text-green-500' : 'text-gray-500'}`} />
              <span className="text-[10px] text-gray-500">
                {location ? 'Localización OK' : 'Capturando GPS...'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !kmEnd || !totalDeliveries}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-lg"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Finalizar y Enviar'}
          </button>
        </form>
      </div>

      {image && (
        <div className="glass p-2 rounded-2xl animate-fade-in">
          <img src={URL.createObjectURL(image)} alt="Final Odometer" className="w-full h-48 object-cover rounded-xl" />
        </div>
      )}
    </div>
  );
}
