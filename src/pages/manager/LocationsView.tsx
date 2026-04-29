import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { 
  MapPin, Plus, Search, Edit2, Trash2, Loader2, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight
} from 'lucide-react';

type SortKey = 'name' | 'region' | 'postalCode' | 'schedule';

export default function LocationsView() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  useEffect(() => {
    const q = query(collection(db, 'locations'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let rows = locations;
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(l =>
        (l.name || '').toLowerCase().includes(s) ||
        (l.region || '').toLowerCase().includes(s) ||
        (l.address || '').toLowerCase().includes(s) ||
        (l.postalCode || '').includes(s)
      );
    }
    return [...rows].sort((a, b) => {
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [locations, search, sort]);

  const requestSort = (key: SortKey) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sort.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => requestSort(col)}
      className="px-6 py-4 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este centro logístico?')) return;
    try { await deleteDoc(doc(db, 'locations', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Centros Logísticos</h1>
          <p className="text-white/40 text-sm mt-1">Gestión centralizada de puntos de carga, horarios y tarifas nocturnas.</p>
        </div>
        <button
          onClick={() => navigate('/manager/locations/new')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Nuevo Centro
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Centros</p>
          <p className="text-3xl font-bold text-white">{locations.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Centros 24h</p>
          <p className="text-3xl font-bold text-blue-400">{locations.filter(l => l.is24h).length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Con Tarifas Especiales</p>
          <p className="text-3xl font-bold text-emerald-400">{locations.filter(l => l.timeRates?.length > 0).length}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            placeholder="Buscar por nombre, CP, región..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-white/20">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Sincronizando centros...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <Th col="name" label="Centro Logístico" />
                  <Th col="region" label="Ubicación" />
                  <Th col="postalCode" label="CP" />
                  <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Dirección</th>
                  <Th col="schedule" label="Horario" />
                  <th className="px-6 py-4 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filtered.map(loc => (
                  <tr 
                    key={loc.id} 
                    onClick={() => navigate(`/manager/locations/${loc.id}`)}
                    className="hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <MapPin className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-base leading-tight">{loc.name}</p>
                          <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider mt-1">
                            {loc.is24h ? 'Abierto 24h' : `${loc.openingTime} - ${loc.closingTime}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm text-white/70">{loc.region || '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2 py-1 bg-white/5 rounded-lg text-xs font-mono text-white/40">{loc.postalCode || '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-white/40 max-w-xs truncate">{loc.address || '—'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60">{loc.schedule || '—'}</span>
                        {loc.timeRates?.length > 0 && (
                          <div className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-bold text-emerald-400 uppercase">
                            Tarifas+
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/manager/locations/${loc.id}`); }}
                          className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, loc.id)}
                          className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                          <Search className="w-8 h-8 text-white/10" />
                        </div>
                        <p className="text-white/20 italic text-sm font-medium">No se encontraron centros que coincidan con la búsqueda</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
