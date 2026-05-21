import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle2, Loader2, Square, CheckCheck, Clock } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

import { db, storage } from '../../lib/firebase';
import {
  doc, getDoc, updateDoc, serverTimestamp,
  getDocs, collection, query, orderBy, where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { isHoliday } from '../../lib/holidays';

interface RouteSummary {
  kms: number;
  totalDeliveries: number;
  extraHours: number;
  isHoliday: boolean;
}

function formatExtraHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// JS getDay() → Spanish day key used in weeklySchedule
const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function getClosingTime(centerData: any, date: Date): string | null {
  if (!centerData || centerData.is24h) return null;
  const dayKey = DAY_KEYS[date.getDay()];
  const ws = centerData.weeklySchedule?.[dayKey];
  if (ws) return ws.open ? (ws.closingTime ?? null) : null; // null if center closed that day
  return centerData.closingTime ?? null; // fallback for legacy location docs
}

function isTimeInRange(current: string, start: string, end: string): boolean {
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end; // crosses midnight
}

export default function EndRoute() {
  const [kmEnd, setKmEnd] = useState('');
  const [totalDeliveries, setTotalDeliveries] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<RouteSummary | null>(null);

  const navigate = useNavigate();
  const { activeRoute, setActiveRoute } = useAuthStore();

  useEffect(() => {
    if (!activeRoute) {
      navigate('/driver/start');
      return;
    }

    // Pre-fill center from where the driver started
    setSelectedCenter(activeRoute.startCenter || '');

    const fetchCenters = async () => {
      const q = query(collection(db, 'locations'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      setCenters(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchCenters();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error('GPS Error:', err),
      );
    }
  }, [activeRoute, navigate]);

  // Live overtime preview — uses today's day-specific closing time
  const overtimePreview = useMemo(() => {
    const centerData = centers.find(c => c.name === selectedCenter);
    const now = new Date();
    const closingTime = getClosingTime(centerData, now);
    if (!closingTime) return null;
    const [closeHour, closeMin] = closingTime.split(':').map(Number);
    const closing = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeHour, closeMin, 0, 0);
    if (now <= closing) return null;
    const overMins = Math.floor((now.getTime() - closing.getTime()) / 60000);
    return { closing: closingTime, overMins };
  }, [centers, selectedCenter]);

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

      const endDateTime = new Date();

      const [driverDoc, holidaysSnap] = await Promise.all([
        getDoc(doc(db, 'users', activeRoute.driverId)),
        getDocs(query(
          collection(db, 'holidays'),
          where('year', '==', endDateTime.getFullYear()),
        )),
      ]);
      const profile = driverDoc.exists() ? driverDoc.data() : null;

      const disabledHolidays: string[] = [];
      const customHolidays: string[] = [];
      holidaysSnap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.disabled === true) disabledHolidays.push(d.id);
        else customHolidays.push(d.id);
      });

      // Total worked hours (start to end, no break deduction)
      let autoHours = 0;
      if (activeRoute.startTime) {
        const start = activeRoute.startTime.toDate
          ? activeRoute.startTime.toDate()
          : new Date(activeRoute.startTime);
        if (!isNaN(start.getTime())) {
          autoHours = Math.max(0, endDateTime.getTime() - start.getTime()) / 3600000;
        }
      }

      const selectedCenterData = centers.find(c => c.name === selectedCenter);

      // Extra hours: based on today's day-specific closing time; fallback to markedHours
      let extraHours = 0;
      const centerClosingTime = getClosingTime(selectedCenterData, endDateTime);

      if (centerClosingTime) {
        const [closeHour, closeMin] = centerClosingTime.split(':').map(Number);
        const closingDateTime = new Date(
          endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate(),
          closeHour, closeMin, 0, 0,
        );
        if (endDateTime > closingDateTime) {
          extraHours = (endDateTime.getTime() - closingDateTime.getTime()) / 3600000;
        }
      } else {
        // 24h, no schedule, or center closed that day — fall back to markedHours threshold
        const threshold = profile?.markedHours || 9;
        extraHours = Math.max(0, autoHours - threshold);
      }

      const kms = Number(kmEnd) - (activeRoute.startKm || 0);
      const kmPay = kms * (profile?.kmRate || 0);

      let rateToUse = profile?.extraHourRate || 0;
      if (extraHours > 0 && selectedCenterData?.timeRates?.length > 0) {
        const endStr = endDateTime.toLocaleTimeString('es-ES', {
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const matchingRate = selectedCenterData.timeRates.find((tr: any) =>
          isTimeInRange(endStr, tr.start, tr.end),
        );
        if (matchingRate) rateToUse = matchingRate.rate;
      }

      const extraPay = extraHours * rateToUse;
      const holidayFlag = isHoliday(endDateTime, customHolidays, disabledHolidays);

      await updateDoc(doc(db, 'routes', activeRoute.id), {
        endTime: serverTimestamp(),
        endKm: Number(kmEnd),
        endLocation: location,
        endCenter: selectedCenter,
        endPhoto: photoUrl,
        totalDeliveries: Number(totalDeliveries),
        autoHours: parseFloat(autoHours.toFixed(4)),
        extraHours: parseFloat(extraHours.toFixed(4)),
        centerClosingTime,
        totalCost: parseFloat((kmPay + extraPay).toFixed(2)),
        kmPay: parseFloat(kmPay.toFixed(2)),
        extraPay: parseFloat(extraPay.toFixed(2)),
        vehicleType: profile?.vehicleType || '',
        vehiclePlate: profile?.vehiclePlate || '',
        isHoliday: holidayFlag,
        status: 'completed',
      });

      setActiveRoute(null);
      setSummary({
        kms,
        totalDeliveries: Number(totalDeliveries),
        extraHours: parseFloat(extraHours.toFixed(4)),
        isHoliday: holidayFlag,
      });
    } catch (err) {
      console.error(err);
      alert('Error al finalizar ruta');
    } finally {
      setLoading(false);
    }
  };

  // ── Summary screen shown after successful completion ───────────────────────
  if (summary) {
    return (
      <div className="max-w-md mx-auto">
        <Helmet>
          <title>BTS Logistics Pro - Jornada Finalizada</title>
        </Helmet>

        <div className="glass p-8 rounded-3xl flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center">
            <CheckCheck className="w-10 h-10 text-green-400" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-black text-white mb-1">¡Jornada Completada!</h2>
            <p className="text-sm text-gray-400">Resumen del día</p>
          </div>

          <div className="w-full grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-blue-400">{summary.kms}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">KM Recorridos</p>
            </div>
            <div className="bg-slate-800/60 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-green-400">{summary.totalDeliveries}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">Repartos</p>
            </div>
            <div className="bg-slate-800/60 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${summary.extraHours > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                {summary.extraHours > 0 ? formatExtraHours(summary.extraHours) : '—'}
              </p>
              <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">Horas Extra</p>
            </div>
          </div>

          {summary.extraHours > 0 && (
            <div className="w-full bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm font-bold text-orange-300">
                {formatExtraHours(summary.extraHours)} de horas extra registradas
              </p>
            </div>
          )}

          {summary.isHoliday && (
            <div className="w-full bg-purple-500/10 border border-purple-500/30 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm font-bold text-purple-300">Jornada en día festivo registrada</p>
            </div>
          )}

          <button
            onClick={() => navigate('/driver/start')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-600/20 text-lg transition-all active:scale-95"
          >
            Nueva Jornada
          </button>
        </div>
      </div>
    );
  }

  // ── End route form ─────────────────────────────────────────────────────────
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
              {/* Center (pre-filled from start, still editable) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">
                  Centro de Reparto
                </label>
                <select
                  value={selectedCenter}
                  onChange={e => setSelectedCenter(e.target.value)}
                  className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none"
                  required
                >
                  <option value="" disabled>Selecciona centro...</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.name}>{center.name}</option>
                  ))}
                </select>
              </div>

              {/* KM End */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Kilometraje Final
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={kmEnd}
                    onChange={e => setKmEnd(e.target.value)}
                    className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    placeholder="00000"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    KM
                  </span>
                </div>
              </div>

              {/* Deliveries */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Repartos Totales
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={totalDeliveries}
                    onChange={e => setTotalDeliveries(e.target.value)}
                    className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-4 px-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    placeholder="0"
                    required
                  />
                  <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            </div>

            {/* Side panel: GPS + optional photo */}
            <div className="flex flex-col gap-4 pt-7">
              <div
                onClick={() => {
                  if (!location && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      err => console.error('GPS Error:', err),
                    );
                  }
                }}
                className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl border transition-all cursor-pointer ${
                  location
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-red-500/30 bg-red-500/5 animate-pulse'
                }`}
              >
                <MapPin className={`w-6 h-6 mb-1 ${location ? 'text-green-500' : 'text-red-400'}`} />
                <span
                  className={`text-[8px] text-center px-1 font-bold ${location ? 'text-green-500' : 'text-red-400'}`}
                >
                  {location ? 'GPS OK' : 'REINTENTAR'}
                </span>
              </div>

              <label
                className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  image
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-gray-700 bg-slate-800/30 hover:bg-slate-800/50'
                }`}
              >
                <Camera className={`w-6 h-6 mb-1 ${image ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="text-[8px] text-center px-1 text-gray-500 font-bold">
                  {image ? 'FOTO OK' : 'SUBIR FOTO'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {overtimePreview && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-300">
                  {overtimePreview.overMins} min de horas extra
                </p>
                <p className="text-xs text-orange-400/70">
                  Cierre del centro: {overtimePreview.closing} — se registrarán automáticamente
                </p>
              </div>
            </div>
          )}

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
          <img
            src={URL.createObjectURL(image)}
            alt="Final Odometer"
            className="w-full h-48 object-cover rounded-xl"
          />
        </div>
      )}
    </div>
  );
}
