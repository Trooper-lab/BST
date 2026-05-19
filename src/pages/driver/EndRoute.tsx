import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle2, Loader2, Square, CheckCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

import { db, storage } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { findClosestLocation } from '../../lib/geoUtils';

export default function EndRoute() {
  const [kmEnd, setKmEnd] = useState('');
  const [totalDeliveries, setTotalDeliveries] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
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
    }

    // Fetch centers
    const fetchCenters = async () => {
      const q = query(collection(db, 'locations'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const centerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCenters(centerData);
      
      // If we already have location, try to find closest now
      if (location && centerData.length > 0) {
        const closest = findClosestLocation(location.lat, location.lng, centerData, 2);
        if (closest) {
          setSelectedCenter(closest.name);
        }
      }
    };
    fetchCenters();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("GPS Error:", err)
      );
    }
  }, [activeRoute, navigate]);

  const [selectedCenter, setSelectedCenter] = useState('');
  const [detectedCenter, setDetectedCenter] = useState<any | null>(null);

  // Helper to check if a time is within a range (handles midnight wrap)
  const isTimeInRange = (currentTime: string, start: string, end: string) => {
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Range crosses midnight (e.g., 22:00 - 04:00)
      return currentTime >= start || currentTime <= end;
    }
  };

  // Proximity check whenever location or centers update
  useEffect(() => {
    if (location && centers.length > 0) {
      const closest = findClosestLocation(location.lat, location.lng, centers, 2);
      if (closest) {
        setDetectedCenter(closest);
        // If nothing selected yet, auto-select
        if (!selectedCenter) {
          setSelectedCenter(closest.name);
        }
      } else {
        setDetectedCenter(null);
      }
    }
  }, [location, centers, selectedCenter]);

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

      // Fetch driver profile to get rates
      const driverDoc = await getDoc(doc(db, 'users', activeRoute.driverId));
      const profile = driverDoc.exists() ? driverDoc.data() : null;

      // Auto-calculate from timestamps
      let autoHours = 0;
      if (activeRoute.startTime) {
        const start = activeRoute.startTime.toDate ? activeRoute.startTime.toDate() : new Date(activeRoute.startTime);
        autoHours = (new Date().getTime() - start.getTime()) / 3600000;
      }

      const routeRef = doc(db, 'routes', activeRoute.id);
      
      // Calculate pay components
      const kms = Number(kmEnd) - (activeRoute.startKm || 0);
      const kmPay = kms * (profile?.kmRate || 0);
      
      // Extra hours threshold: user.markedHours or default 9
      const threshold = profile?.markedHours || 9;
      const extraHours = Math.max(0, autoHours - threshold);
      
      // Determine the rate for extra hours
      let rateToUse = profile?.extraHourRate || 0;
      const selectedCenterData = centers.find(c => c.name === selectedCenter);
      
      if (extraHours > 0 && selectedCenterData?.timeRates?.length > 0) {
        const nowStr = new Date().toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        });
        
        const matchingRate = selectedCenterData.timeRates.find((tr: any) => 
          isTimeInRange(nowStr, tr.start, tr.end)
        );
        
        if (matchingRate) {
          rateToUse = matchingRate.rate;
          console.log(`Applying special time rate: ${rateToUse}€/h for ${nowStr}`);
        }
      }
      
      const extraPay = extraHours * rateToUse;
      const totalCost = kmPay + extraPay;

      await updateDoc(routeRef, {
        endTime: serverTimestamp(),
        endKm: Number(kmEnd),
        endLocation: location,
        endCenter: selectedCenter,
        endPhoto: photoUrl,
        totalDeliveries: Number(totalDeliveries),
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
      <Helmet>
        <title>BTS Logistics Pro - Finalizar Ruta</title>
      </Helmet>

      <div className="glass p-6 rounded-3xl">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-400">
          <Square className="w-5 h-5 fill-red-400" />
          Finalizar Reparto
        </h2>

        <form onSubmit={handleEnd} className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-6">
              {/* Destination Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-400">Punto de Entrega / Retorno</label>
                  {detectedCenter && (
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <CheckCheck className="w-3 h-3" /> CERCANO
                    </span>
                  )}
                </div>
                <select
                  value={selectedCenter}
                  onChange={(e) => { setSelectedCenter(e.target.value); }}
                  className={`w-full bg-slate-800/50 border rounded-xl py-4 px-4 text-white focus:outline-none focus:ring-2 appearance-none transition-all ${
                    detectedCenter && selectedCenter === detectedCenter.name 
                      ? 'border-green-500/50 ring-green-500/20' 
                      : 'border-gray-700 focus:ring-red-500/50'
                  }`}
                  required
                >
                  <option value="" disabled>Selecciona centro...</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.name}>{center.name}</option>
                  ))}
                </select>
                {detectedCenter && selectedCenter !== detectedCenter.name && (
                  <p className="text-[10px] text-gray-500 mt-1 italic">
                    Estás cerca de <span className="text-green-400 font-bold">{detectedCenter.name}</span>
                  </p>
                )}
              </div>

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
            </div>

            {/* Side Automatic Info */}
            <div className="flex flex-col gap-4 pt-7">
              <div 
                onClick={() => {
                  if (!location && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      (err) => console.error("GPS Error:", err)
                    );
                  }
                }}
                className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl border transition-all cursor-pointer ${location ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/30 bg-red-500/5 animate-pulse'}`}
              >
                <MapPin className={`w-6 h-6 mb-1 ${location ? 'text-green-500' : 'text-red-400'}`} />
                <span className={`text-[8px] text-center px-1 font-bold ${location ? 'text-green-500' : 'text-red-400'}`}>
                  {location ? 'GPS OK' : 'REINTENTAR'}
                </span>
              </div>
              
              <label className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${image ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-700 bg-slate-800/30 hover:bg-slate-800/50'}`}>
                <Camera className={`w-6 h-6 mb-1 ${image ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="text-[8px] text-center px-1 text-gray-500 font-bold">{image ? 'FOTO OK' : 'SUBIR FOTO'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="hidden" 
                />
              </label>
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
