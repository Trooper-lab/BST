import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, ChevronRight, X, Loader2, MapPin, Truck, Clock, Flag, CheckCircle2, EyeOff } from 'lucide-react';
import { db } from '../../lib/firebase';
import {
  collection, onSnapshot, query, orderBy, where,
  doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { getSpanishNationalHolidayName } from '../../lib/holidays';

// ── helpers ───────────────────────────────────────────────────────────────────

const toIso = (d: Date) => d.toISOString().slice(0, 10);

const dayOfWeekMon = (d: Date) => {
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
};

const WEEK_LABELS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

type HolidayRecord = { note: string; disabled: boolean };

// ── component ─────────────────────────────────────────────────────────────────

export default function CalendarView() {
  const { user, profile } = useAuthStore();
  const isSuperAdmin = profile?.role === 'superadmin';

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [routes, setRoutes]             = useState<any[]>([]);
  const [holidays, setHolidays]         = useState<Record<string, HolidayRecord>>({});
  const [selectedDay, setSelectedDay]   = useState<number | null>(null);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // ── date math ─────────────────────────────────────────────────────────────
  const year        = currentMonth.getFullYear();
  const month       = currentMonth.getMonth(); // 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridOffset  = dayOfWeekMon(new Date(year, month, 1));
  const today       = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // ── Firestore: routes for visible month ───────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    setLoadingRoutes(true);
    const start = startOfMonth(currentMonth);
    const end   = endOfMonth(currentMonth);

    const q = profile.role === 'company'
      ? query(collection(db, 'routes'), where('companyId', '==', user.uid), orderBy('startTime', 'asc'))
      : query(collection(db, 'routes'), orderBy('startTime', 'asc'));

    const unsub = onSnapshot(q, snap => {
      setRoutes(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter(r => {
            if (!r.startTime) return false;
            const d: Date = r.startTime.toDate ? r.startTime.toDate() : new Date(r.startTime);
            return d >= start && d <= end;
          }),
      );
      setLoadingRoutes(false);
    });
    return () => unsub();
  }, [user, profile, currentMonth]);

  // ── Firestore: holidays for visible year ──────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'holidays'), where('year', '==', year)),
      snap => {
        const map: Record<string, HolidayRecord> = {};
        snap.docs.forEach(d => {
          const data = d.data() as any;
          map[d.id] = { note: data.note || '', disabled: data.disabled === true };
        });
        setHolidays(map);
      },
    );
    return () => unsub();
  }, [year]);

  // ── per-day helpers ───────────────────────────────────────────────────────
  const iso = (day: number) => toIso(new Date(year, month, day));

  /** Name of the Spanish national holiday on this day, or null */
  const nationalName = (day: number) =>
    getSpanishNationalHolidayName(new Date(year, month, day));

  /** Superadmin has disabled this national holiday */
  const isDisabled = (day: number) => holidays[iso(day)]?.disabled === true;

  /** Superadmin has added this non-national day as a custom holiday */
  const isCustom = (day: number) => {
    const rec = holidays[iso(day)];
    return !!rec && rec.disabled === false;
  };

  /** Is this day effectively a holiday (national & not disabled, or custom) */
  const isEffective = (day: number) =>
    (!!nationalName(day) && !isDisabled(day)) || isCustom(day);

  // ── routes by day ─────────────────────────────────────────────────────────
  const routesByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    routes.forEach(r => {
      const d: Date = r.startTime.toDate ? r.startTime.toDate() : new Date(r.startTime);
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(r);
    });
    return map;
  }, [routes]);

  // ── month summary ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const effectiveHolidays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      .filter(d => isEffective(d)).length;
    return {
      totalRoutes:  routes.length,
      completed:    routes.filter(r => r.status === 'completed').length,
      deliveries:   routes.reduce((a, r) => a + (Number(r.totalDeliveries) || 0), 0),
      totalKm:      routes.reduce((a, r) => a + ((Number(r.endKm)||0) - (Number(r.startKm)||0)), 0),
      holidays:     effectiveHolidays,
    };
  }, [routes, holidays, year, month, daysInMonth]);

  // ── toggle holiday ────────────────────────────────────────────────────────
  const toggleHoliday = async (day: number) => {
    if (!isSuperAdmin || savingHoliday) return;
    setSavingHoliday(true);
    const dateIso = iso(day);
    try {
      if (nationalName(day)) {
        // National holiday: toggle the disabled override
        if (isDisabled(day)) {
          await deleteDoc(doc(db, 'holidays', dateIso)); // re-enable
        } else {
          await setDoc(doc(db, 'holidays', dateIso), {
            date: dateIso, year, month: month + 1,
            disabled: true,
            createdBy: user?.uid,
            createdAt: new Date(),
          });
        }
      } else {
        // Non-national day: toggle custom holiday
        if (isCustom(day)) {
          await deleteDoc(doc(db, 'holidays', dateIso));
        } else {
          await setDoc(doc(db, 'holidays', dateIso), {
            date: dateIso, year, month: month + 1,
            disabled: false, note: '',
            createdBy: user?.uid,
            createdAt: new Date(),
          });
        }
      }
    } finally {
      setSavingHoliday(false);
    }
  };

  const selectedRoutes = selectedDay ? (routesByDay[selectedDay] || []) : [];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>BTS Logistics Pro - Calendario</title>
      </Helmet>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Flag className="w-7 h-7 text-blue-500" />
            Calendario de Operaciones
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Actividad de rutas, festivos nacionales y días festivos personalizados.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            className="px-4 py-1.5 text-sm font-bold text-white min-w-[160px] text-center capitalize"
          >
            {MONTH_LABELS[month]} {year}
          </button>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Rutas totales',  value: summary.totalRoutes,           color: 'text-blue-400' },
          { label: 'Completadas',    value: summary.completed,             color: 'text-emerald-400' },
          { label: 'Entregas',       value: summary.deliveries,            color: 'text-purple-400' },
          { label: 'Km totales',     value: `${Math.round(summary.totalKm)} km`, color: 'text-amber-400' },
          { label: 'Días festivos',  value: summary.holidays,              color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Calendar + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ── Calendar ── */}
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Legend */}
          <div className="px-6 pt-5 pb-3 flex flex-wrap gap-x-5 gap-y-2 border-b border-white/5">
            {[
              { cls: 'bg-red-500/20 border border-red-500/30',     label: 'Festivo nacional' },
              { cls: 'bg-orange-500/20 border border-orange-500/30', label: 'Festivo personalizado' },
              { cls: 'bg-white/5 border border-white/10 line-through opacity-50', label: 'Nacional desactivado' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${l.cls}`} />
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{l.label}</span>
              </div>
            ))}
            {isSuperAdmin && (
              <span className="text-[10px] text-white/20 ml-auto italic hidden md:block">
                Clic → detalle · Doble clic → festivo
              </span>
            )}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.015]">
            {WEEK_LABELS.map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          {loadingRoutes ? (
            <div className="flex items-center justify-center py-32 gap-3 text-white/20">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-bold uppercase tracking-widest">Cargando...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-white/[0.04]">
              {Array.from({ length: gridOffset }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[100px] bg-slate-950/30" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayRoutes  = routesByDay[day] || [];
                const isToday    = isCurrentMonth && day === today.getDate();
                const natName    = nationalName(day);
                const disabled   = isDisabled(day);
                const custom     = isCustom(day);
                const isSelected = selectedDay === day;
                const deliveries = dayRoutes.reduce((a, r) => a + (Number(r.totalDeliveries) || 0), 0);

                // Cell background
                let cellBg = 'hover:bg-white/[0.025]';
                if (natName && !disabled)  cellBg = 'bg-red-950/30 hover:bg-red-950/50';
                else if (custom)           cellBg = 'bg-orange-950/30 hover:bg-orange-950/50';
                if (isSelected)            cellBg += ' ring-2 ring-inset ring-blue-500/60';

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(d => d === day ? null : day)}
                    onDoubleClick={() => isSuperAdmin && toggleHoliday(day)}
                    className={`min-h-[100px] p-2.5 cursor-pointer transition-all relative ${cellBg}`}
                  >
                    {/* Day number */}
                    <div className="flex items-start justify-between mb-1.5 gap-1">
                      <span className={`text-sm font-bold leading-none shrink-0 ${
                        isToday
                          ? 'w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs'
                          : (natName && !disabled) || custom ? 'text-red-300/80' : disabled ? 'text-white/20' : 'text-white/50'
                      }`}>
                        {day}
                      </span>

                      {/* Holiday badge */}
                      {natName && !disabled && (
                        <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-red-500/20 text-red-400 leading-none shrink-0">
                          NAC
                        </span>
                      )}
                      {natName && disabled && (
                        <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-white/5 text-white/20 leading-none shrink-0 line-through">
                          NAC
                        </span>
                      )}
                      {custom && (
                        <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 leading-none shrink-0">
                          FEST
                        </span>
                      )}
                    </div>

                    {/* Holiday name (national, truncated) */}
                    {natName && !disabled && (
                      <p className="text-[9px] text-red-400/70 font-medium leading-tight mb-1 truncate">
                        {natName}
                      </p>
                    )}
                    {natName && disabled && (
                      <p className="text-[9px] text-white/15 font-medium leading-tight mb-1 truncate line-through">
                        {natName}
                      </p>
                    )}

                    {/* Route pills */}
                    {dayRoutes.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                          <Truck className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                          <span className="text-[9px] font-bold text-blue-300 leading-none">
                            {dayRoutes.length} ruta{dayRoutes.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {deliveries > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            <span className="text-[9px] font-bold text-emerald-300 leading-none">
                              {deliveries} entregas
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {savingHoliday && isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded">
                        <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {selectedDay ? (
            <div className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
              {/* Day header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {WEEK_LABELS[dayOfWeekMon(new Date(year, month, selectedDay))]}
                  </p>
                  <h3 className="text-xl font-bold text-white">
                    {selectedDay} de {MONTH_LABELS[month]}
                  </h3>
                  {/* Show holiday name in header */}
                  {nationalName(selectedDay) && (
                    <p className={`text-xs font-bold mt-0.5 ${isDisabled(selectedDay) ? 'text-white/20 line-through' : 'text-red-300'}`}>
                      {nationalName(selectedDay)}
                    </p>
                  )}
                  {isCustom(selectedDay) && (
                    <p className="text-xs font-bold text-orange-300 mt-0.5">Festivo personalizado</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Holiday control (superadmin only) */}
              {isSuperAdmin && (
                <div className="px-5 py-4 border-b border-white/5 space-y-2">
                  {nationalName(selectedDay) ? (
                    /* National holiday: can disable/re-enable */
                    <button
                      onClick={() => toggleHoliday(selectedDay!)}
                      disabled={savingHoliday}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isDisabled(selectedDay)
                          ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                          : 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {savingHoliday
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : isDisabled(selectedDay)
                            ? <Flag className="w-4 h-4" />
                            : <EyeOff className="w-4 h-4" />
                        }
                        <div className="text-left">
                          <p className="text-sm font-bold leading-tight">
                            {isDisabled(selectedDay) ? 'Reactivar festivo nacional' : 'Desactivar festivo nacional'}
                          </p>
                          <p className="text-[10px] opacity-60 leading-tight">
                            {isDisabled(selectedDay)
                              ? 'Volverá a contar como festivo'
                              : 'No contará como festivo este año'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${isDisabled(selectedDay) ? 'bg-white/10' : 'bg-red-500'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isDisabled(selectedDay) ? 'left-0.5' : 'left-5'}`} />
                      </div>
                    </button>
                  ) : (
                    /* Non-national day: add/remove custom holiday */
                    <button
                      onClick={() => toggleHoliday(selectedDay!)}
                      disabled={savingHoliday}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isCustom(selectedDay)
                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {savingHoliday
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Flag className="w-4 h-4" />
                        }
                        <span className="text-sm font-bold">
                          {isCustom(selectedDay) ? 'Quitar festivo personalizado' : 'Marcar como festivo'}
                        </span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${isCustom(selectedDay) ? 'bg-orange-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isCustom(selectedDay) ? 'left-5' : 'left-0.5'}`} />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Routes list */}
              <div className="p-5 space-y-3 max-h-[440px] overflow-y-auto">
                {selectedRoutes.length === 0 ? (
                  <div className="py-8 text-center">
                    <Truck className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-sm text-white/25">Sin actividad este día</p>
                  </div>
                ) : (
                  selectedRoutes.map(route => {
                    const startT = route.startTime?.toDate ? route.startTime.toDate() : new Date(route.startTime);
                    const endT   = route.endTime?.toDate   ? route.endTime.toDate()   : null;
                    const km     = (Number(route.endKm) || 0) - (Number(route.startKm) || 0);
                    return (
                      <div key={route.id} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${route.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            <span className="text-sm font-bold text-white truncate max-w-[140px]">
                              {route.driverName || route.driverId?.slice(0, 8)}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            route.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {route.status === 'completed' ? 'Completada' : 'Activa'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-white/50">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              {format(startT, 'HH:mm')}
                              {endT ? ` → ${format(endT, 'HH:mm')}` : ' → activo'}
                            </span>
                          </div>
                          {route.endCenter && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{route.endCenter}</span>
                            </div>
                          )}
                          {km > 0 && (
                            <div className="flex items-center gap-1">
                              <Truck className="w-3 h-3 shrink-0" />
                              <span>{km} km</span>
                            </div>
                          )}
                          {route.totalDeliveries > 0 && (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>{route.totalDeliveries} entregas</span>
                            </div>
                          )}
                        </div>

                        {route.isHoliday && (
                          <div className="flex items-center gap-1 text-[10px] text-orange-400">
                            <Flag className="w-3 h-3" />
                            <span>Registrado en festivo</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ── No day selected: month overview ── */
            <>
              <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Resumen del mes</h3>
                {[
                  { label: 'Días con actividad', value: new Set(routes.map(r => { const d = r.startTime.toDate ? r.startTime.toDate() : new Date(r.startTime); return d.getDate(); })).size, icon: Truck, color: 'text-blue-400' },
                  { label: 'Rutas completadas',  value: summary.completed,  icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Total entregas',     value: summary.deliveries, icon: CheckCircle2, color: 'text-purple-400' },
                  { label: 'Km recorridos',      value: `${Math.round(summary.totalKm)} km`, icon: Truck, color: 'text-amber-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/60">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-sm">{s.label}</span>
                    </div>
                    <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Festivos del mes */}
              <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Festivos del mes</h3>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                  .filter(d => isEffective(d) || (!!nationalName(d) && isDisabled(d)))
                  .map(d => {
                    const natN    = nationalName(d);
                    const disabled = isDisabled(d);
                    const custom  = isCustom(d);
                    return (
                      <div key={d} className={`flex items-center justify-between ${disabled ? 'opacity-40' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Flag className={`w-3.5 h-3.5 shrink-0 ${natN ? 'text-red-400' : 'text-orange-400'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm text-white/70 truncate ${disabled ? 'line-through' : ''}`}>
                              {d} — {natN || 'Festivo personalizado'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                          disabled       ? 'bg-white/5 text-white/20'
                          : natN         ? 'bg-red-500/10 text-red-400'
                          : custom       ? 'bg-orange-500/10 text-orange-400'
                          : ''
                        }`}>
                          {disabled ? 'Desact.' : natN ? 'Nacional' : 'Custom'}
                        </span>
                      </div>
                    );
                  })}
                {!Array.from({ length: daysInMonth }, (_, i) => i + 1)
                  .some(d => isEffective(d) || !!nationalName(d)) && (
                  <p className="text-sm text-white/20 italic">Sin festivos este mes</p>
                )}
              </div>

              {isSuperAdmin && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
                  <p className="text-xs text-blue-300/70 leading-relaxed">
                    <strong className="text-blue-300">Tip:</strong> Haz clic en un día para ver su detalle y gestionar su estado de festivo. Los festivos nacionales se muestran automáticamente pero se pueden desactivar individualmente.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
