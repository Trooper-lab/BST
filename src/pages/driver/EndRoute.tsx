import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle2, Loader2, Square, CheckCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

import { db, storage } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { findClosestLocation } from '../../lib/geoUtils';
import { Clock } from 'lucide-react';

// RouteTimer component removed as per user request to only show in header


export default function EndRoute() {
  const [kmEnd, setKmEnd] = useState('');
  const [totalDeliveries, setTotalDeliveries] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [lunchLimit, setLunchLimit] = useState(60);
  
  const navigate = useNavigate();
  const { activeRoute, setActiveRoute } = useAuthStore();

  // Load lunch state from activeRoute if available
  useEffect(() => {
    if (activeRoute?.lunchStartTime && activeRoute?.lunchLimit) {
      setLunchLimit(activeRoute.lunchLimit);
    } else {
      // If no break is active, default to the remaining pool time
      const used = activeRoute?.lunchMinutesUsed || 0;
      setLunchLimit(Math.max(0, 60 - used));
    }
  }, [activeRoute?.lunchStartTime, activeRoute?.lunchLimit, activeRoute?.lunchMinutesUsed]);

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

  const handleStartBreak = async () => {
    if (!activeRoute?.id) return;
    const used = activeRoute.lunchMinutesUsed || 0;
    const remaining = Math.max(0, 60 - used);
    
    if (remaining <= 0) {
      alert('Ya has usado tus 60 minutos de descanso.');
      return;
    }

    const duration = Math.min(lunchLimit, remaining);

    try {
      await updateDoc(doc(db, 'routes', activeRoute.id), {
        lunchStartTime: serverTimestamp(),
        lunchLimit: duration
      });
      setActiveRoute({ 
        ...activeRoute, 
        lunchStartTime: new Date(), 
        lunchLimit: duration 
      });
    } catch (err) {
      console.error(err);
    }
  };

  // const handleEndBreak = async () => {
  //   if (!activeRoute?.id || !activeRoute?.lunchStartTime) return;
  //   
  //   const used = activeRoute.lunchMinutesUsed || 0;
  //   const currentLimit = activeRoute.lunchLimit || 60;
  //   const newUsed = used + currentLimit;
  // 
  //   try {
  //     await updateDoc(doc(db, 'routes', activeRoute.id), {
  //       lunchStartTime: null,
  //       lunchLimit: 0,
  //       lunchMinutesUsed: newUsed
  //     });
  //     setActiveRoute({ 
  //       ...activeRoute, 
  //       lunchStartTime: null, 
  //       lunchLimit: 0,
  //       lunchMinutesUsed: newUsed
  //     });
  //     setLunchLimit(Math.max(0, 60 - newUsed));
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

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
        if (!isNaN(start.getTime())) {
          // Total elapsed time
          const now = new Date();
          const totalMs = now.getTime() - start.getTime();
          
          // Calculate break deduction
          let lunchMs = (activeRoute.lunchMinutesUsed || 0) * 60000;
          if (activeRoute.lunchStartTime) {
            const breakStart = activeRoute.lunchStartTime.toDate ? activeRoute.lunchStartTime.toDate() : new Date(activeRoute.lunchStartTime);
            if (!isNaN(breakStart.getTime())) {
              const breakElapsed = now.getTime() - breakStart.getTime();
              const limitMs = (activeRoute.lunchLimit || 60) * 60000;
              lunchMs += Math.min(breakElapsed, limitMs);
            }
          }
          
          autoHours = Math.max(0, totalMs - lunchMs) / 3600000;
        }
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
        lunchLimit: activeRoute.lunchLimit || lunchLimit,
        lunchStartTime: activeRoute.lunchStartTime || null,
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

        {/* Lunch Break Section */}
        <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-orange-400 font-bold uppercase">Descanso / Lunch</p>
                <p className="text-[10px] text-gray-500">Auto-pausa el tiempo de jornada</p>
              </div>
            </div>
            {(() => {
              const used = activeRoute?.lunchMinutesUsed || 0;
              const remaining = Math.max(0, 60 - used);

              if (!activeRoute?.lunchStartTime) {
                return (
                  <button
                    type="button"
                    disabled={remaining <= 0}
                    onClick={handleStartBreak}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-orange-500 transition-all disabled:opacity-50"
                  >
                    INICIAR DESCANSO ({remaining}m disp.)
                  </button>
                );
              }

              const breakStart = activeRoute.lunchStartTime.toDate ? activeRoute.lunchStartTime.toDate() : new Date(activeRoute.lunchStartTime);
              const breakLimit = activeRoute.lunchLimit || 60;
              // Break UI is only shown if lunchStartTime is present and NOT expired.
              // If it's expired, the background process in DriverLayout will clear it,
              // and the logic above (!activeRoute?.lunchStartTime) will take over.
              const isExpired = (new Date().getTime() - breakStart.getTime()) >= (breakLimit * 60000);
              
              if (isExpired) return null;

              return (
                <div className="px-4 py-2 bg-slate-800 text-orange-400 rounded-xl text-xs font-bold border border-orange-500/30 flex flex-col items-center leading-tight">
                  <span>DESCANSO ACTIVO</span>
                  <span className="text-[9px] opacity-60">Expira en {breakLimit}m</span>
                </div>
              );
            })()}
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                {activeRoute?.lunchStartTime ? 'Pausa Actual' : 'Minutos de Pausa'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={lunchLimit}
                  onChange={(e) => setLunchLimit(Math.min(60 - (activeRoute?.lunchMinutesUsed || 0), Math.max(0, Number(e.target.value))))}
                  disabled={!!activeRoute?.lunchStartTime}
                  className="w-full bg-slate-900/50 border border-gray-700 rounded-xl py-2 px-3 text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50"
                  placeholder="60"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">MIN</span>
              </div>
            </div>
            {!activeRoute?.lunchStartTime && (
              <div className="flex gap-1">
                {[15, 30, 45, 60].filter(m => m <= (60 - (activeRoute?.lunchMinutesUsed || 0))).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLunchLimit(m)}
                    className={`w-10 h-10 rounded-lg border text-[10px] font-bold transition-all ${
                      lunchLimit === m 
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                        : 'bg-slate-800/50 border-gray-700 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    {m}'
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Usado</p>
              <p className="text-xl font-black text-white">
                {activeRoute?.lunchMinutesUsed || 0}
                <span className="text-xs text-gray-500 ml-1">/ 60 min</span>
              </p>
            </div>
          </div>
        </div>

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
