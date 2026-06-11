import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, Users, Loader2, Play, CheckCircle2 } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { findClosestLocation } from '../../lib/geoUtils';

export default function StartRoute() {
  const [kmStart, setKmStart] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasHelper, setHasHelper] = useState(false);
  
  const navigate = useNavigate();
  const { user, profile, activeRoute, setActiveRoute } = useAuthStore();

  useEffect(() => {
    // If a route is already active, skip the start form
    if (activeRoute) {
      navigate('/driver/end');
      return;
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

  const [detectedCenter, setDetectedCenter] = useState<any | null>(null);

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

  useEffect(() => {
    if (profile?.fixedHelper) {
      setHasHelper(true);
    }
  }, [profile]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmStart || !selectedCenter) return;
    setLoading(true);

    try {
      let photoUrl = '';
      if (image) {
        const storageRef = ref(storage, `odometers/${user.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, image);
        photoUrl = await getDownloadURL(storageRef);
      }

      const routeData = {
        driverId: user.uid,
        driverName: profile?.firstName ? `${profile.firstName} ${profile.lastName}` : (user.name || user.displayName || 'Conductor'),
        companyId: profile?.companyId || null,
        startTime: serverTimestamp(),
        startKm: Number(kmStart),
        startLocation: location,
        startCenter: selectedCenter,
        startPhoto: photoUrl,
        hasHelper,
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'routes'), routeData);
      
      // Use a local Date for immediate UI feedback while Firestore processes serverTimestamp
      setActiveRoute({ 
        id: docRef.id, 
        ...routeData,
        startTime: new Date() 
      });
      navigate('/driver/end');
    } catch (err) {
      console.error(err);
      alert('Error al iniciar ruta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="glass p-6 rounded-3xl">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Play className="text-green-500 fill-green-500 w-5 h-5" />
          Iniciar Reparto
        </h2>

        <form onSubmit={handleStart} className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-6">
              {/* Center Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-400">Centro de Salida</label>
                  {detectedCenter && (
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3 h-3" /> CERCANO
                    </span>
                  )}
                </div>
                <select
                  value={selectedCenter}
                  onChange={(e) => setSelectedCenter(e.target.value)}
                  className={`w-full bg-slate-800/50 border rounded-xl py-4 px-4 text-white focus:outline-none focus:ring-2 appearance-none transition-all ${
                    detectedCenter && selectedCenter === detectedCenter.name 
                      ? 'border-green-500/50 ring-blue-500/20' 
                      : 'border-gray-700 focus:ring-blue-500/50'
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
                <label className="block text-sm font-medium text-gray-400 mb-2">Kilometraje Inicial</label>
                <div className="relative">
                  <input
                    type="number"
                    value={kmStart}
                    onChange={(e) => setKmStart(e.target.value)}
                    className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="00000"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">KM</span>
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

          {/* Helper Toggle */}
          <button
            type="button"
            onClick={() => !profile?.fixedHelper && setHasHelper(!hasHelper)}
            disabled={profile?.fixedHelper}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
              hasHelper ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/30 border-gray-700'
            } ${profile?.fixedHelper ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <Users className={hasHelper ? 'text-blue-400' : 'text-gray-500'} />
              <span className="font-medium">¿Llevas Ayudante?</span>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-all ${hasHelper ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-all ${hasHelper ? 'translate-x-6' : ''}`} />
            </div>
          </button>

          <button
            type="submit"
            disabled={loading || !kmStart}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-lg"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Comenzar Jornada'}
          </button>
        </form>
      </div>

      {image && (
        <div className="glass p-2 rounded-2xl animate-fade-in">
          <img src={URL.createObjectURL(image)} alt="Odometer" className="w-full h-48 object-cover rounded-xl" />
        </div>
      )}
    </div>
  );
}
