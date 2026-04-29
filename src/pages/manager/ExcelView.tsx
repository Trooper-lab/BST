import { useState, useEffect, useMemo } from 'react';
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RouteInspector from '../../components/manager/RouteInspector';

const getMs = (val: any): number => {
  if (!val) return 0;
  if (val.toDate) return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const fmtTime = (val: any) => {
  const ms = getMs(val);
  return ms ? format(new Date(ms), 'dd/MM/yy HH:mm', { locale: es }) : '—';
};

const fmtDuration = (startVal: any, endVal: any) => {
  const s = getMs(startVal);
  const e = getMs(endVal);
  if (!s || !e) return '—';
  const h = (e - s) / 3600000;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm.toString().padStart(2, '0')}m`;
};

type SortKey = 'startTime' | 'endTime' | 'driver' | 'km' | 'cost' | 'deliveries';

const ExcelView = () => {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'startTime', dir: 'desc' });
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'routes'), orderBy('startTime', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let rows = routes;

    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        (r.driverName || '').toLowerCase().includes(s) ||
        (r.startCenter || '').toLowerCase().includes(s) ||
        (r.endCenter || '').toLowerCase().includes(s)
      );
    }

    rows = [...rows].sort((a, b) => {
      let av: any, bv: any;
      switch (sort.key) {
        case 'startTime': av = getMs(a.startTime); bv = getMs(b.startTime); break;
        case 'endTime':   av = getMs(a.endTime);   bv = getMs(b.endTime);   break;
        case 'driver':    av = a.driverName || ''; bv = b.driverName || ''; break;
        case 'km':        av = (Number(a.endKm) - Number(a.startKm)) || 0; bv = (Number(b.endKm) - Number(b.startKm)) || 0; break;
        case 'cost':      av = Number(a.totalCost) || 0; bv = Number(b.totalCost) || 0; break;
        case 'deliveries':av = Number(a.totalDeliveries) || 0; bv = Number(b.totalDeliveries) || 0; break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [routes, search, sort]);

  const totals = useMemo(() => ({
    km: filtered.reduce((s, r) => s + ((Number(r.endKm) - Number(r.startKm)) || 0), 0),
    deliveries: filtered.reduce((s, r) => s + (Number(r.totalDeliveries) || 0), 0),
    cost: filtered.reduce((s, r) => s + (Number(r.totalCost) || 0), 0),
    active: filtered.filter(r => r.status === 'active').length,
    completed: filtered.filter(r => r.status === 'completed').length,
  }), [filtered]);

  const requestSort = (key: SortKey) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sort.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  const exportXlsx = () => {
    const rows = filtered.map(r => {
      const startMs = getMs(r.startTime);
      const endMs = getMs(r.endTime);
      const durationH = (startMs && endMs) ? ((endMs - startMs) / 3600000) : 0;
      const km = (Number(r.endKm) - Number(r.startKm)) || 0;
      return {
        'ID Ruta': r.id,
        'Conductor': r.driverName || '—',
        'Fecha Inicio': startMs ? format(new Date(startMs), 'dd/MM/yyyy', { locale: es }) : '—',
        'Hora Inicio': startMs ? format(new Date(startMs), 'HH:mm') : '—',
        'Hora Fin': endMs ? format(new Date(endMs), 'HH:mm') : '—',
        'Duración (h)': durationH ? durationH.toFixed(2) : '—',
        'Centro Salida': r.startCenter || '—',
        'Centro Llegada': r.endCenter || '—',
        'KM Inicial': r.startKm ?? '—',
        'KM Final': r.endKm ?? '—',
        'KM Total': km || '—',
        'Repartos': r.totalDeliveries ?? '—',
        'Ayudante': r.hasHelper ? 'Sí' : 'No',
        'Coste (€)': r.totalCost ? Number(r.totalCost).toFixed(2) : '—',
        'Estado': r.status === 'active' ? 'Activa' : 'Completada',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rutas');
    XLSX.writeFile(wb, `BST_Rutas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => requestSort(col)}
      className="px-4 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Registro de Rutas</h1>
          <p className="text-white/40 text-sm mt-1">{filtered.length} rutas · datos completos y financieros</p>
        </div>
        <button
          onClick={exportXlsx}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 shrink-0"
        >
          <Download className="w-4 h-4" />
          Exportar XLSX
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Rutas', value: filtered.length, unit: '' },
          { label: 'Activas', value: totals.active, unit: '' },
          { label: 'KM Total', value: totals.km.toFixed(0), unit: 'km' },
          { label: 'Repartos', value: totals.deliveries, unit: '' },
          { label: 'Coste Total', value: `${totals.cost.toFixed(2)}`, unit: '€' },
        ].map(c => (
          <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <p className="text-[10px] text-white/40 uppercase font-bold">{c.label}</p>
            <p className="text-xl font-bold text-white mt-0.5">{c.value}<span className="text-sm text-white/40 ml-1">{c.unit}</span></p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar conductor, origen, destino..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/8"
        />
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-white/30">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Cargando rutas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Conductor</th>
                  <Th col="startTime" label="Fecha inicio" />
                  <Th col="endTime" label="Fecha fin" />
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Duración</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Origen</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Destino</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">KM ini.</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">KM fin.</th>
                  <Th col="km" label="KM total" />
                  <Th col="deliveries" label="Repartos" />
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Ayudante</th>
                  <Th col="cost" label="Coste (€)" />
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(r => {
                  const km = (Number(r.endKm) - Number(r.startKm)) || 0;
                  const isActive = r.status === 'active';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRoute(r)}
                      className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0">
                            {(r.driverName || '?').charAt(0)}
                          </div>
                          {r.driverName || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{fmtTime(r.startTime)}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{isActive ? <span className="text-emerald-400 text-xs font-bold">EN RUTA</span> : fmtTime(r.endTime)}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{fmtDuration(r.startTime, r.endTime)}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap max-w-[140px] truncate">{r.startCenter || '—'}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap max-w-[140px] truncate">{r.endCenter || '—'}</td>
                      <td className="px-4 py-3 text-white/50 tabular-nums">{r.startKm ?? '—'}</td>
                      <td className="px-4 py-3 text-white/50 tabular-nums">{r.endKm ?? '—'}</td>
                      <td className="px-4 py-3 font-bold text-white tabular-nums">{km ? `${km} km` : '—'}</td>
                      <td className="px-4 py-3 text-white/70 tabular-nums text-center">{r.totalDeliveries ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.hasHelper ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/20'}`}>
                          {r.hasHelper ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                        {r.totalCost ? `${Number(r.totalCost).toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {isActive && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                          {isActive ? 'Activa' : 'Completada'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-white/20 italic text-sm">
                      No se encontraron rutas
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Totals footer */}
              {filtered.length > 0 && (
                <tfoot className="border-t border-white/10 bg-white/[0.03]">
                  <tr>
                    <td colSpan={8} className="px-4 py-3 text-[10px] font-bold text-white/30 uppercase">Totales ({filtered.length} rutas)</td>
                    <td className="px-4 py-3 font-bold text-white tabular-nums">{totals.km.toFixed(0)} km</td>
                    <td className="px-4 py-3 font-bold text-white tabular-nums text-center">{totals.deliveries}</td>
                    <td />
                    <td className="px-4 py-3 font-bold text-emerald-400 tabular-nums whitespace-nowrap">{totals.cost.toFixed(2)} €</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {selectedRoute && (
        <RouteInspector
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
};

export default ExcelView;
