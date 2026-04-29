import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Plus, Search, Edit2, Trash2, X, Check, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortKey = 'name' | 'region' | 'postalCode' | 'schedule';

const EMPTY_FORM = { name: '', address: '', postalCode: '', region: '', schedule: '', type: 'logistic_center' };

export default function LocationsView() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
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
      className="px-4 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap"
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  const openAdd = () => {
    setEditingLocation(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (loc: any) => {
    setEditingLocation(loc);
    setFormData({ name: loc.name, address: loc.address, postalCode: loc.postalCode, region: loc.region, schedule: loc.schedule, type: loc.type || 'logistic_center' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este centro logístico?')) return;
    try { await deleteDoc(doc(db, 'locations', id)); } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingLocation) {
        await updateDoc(doc(db, 'locations', editingLocation.id), { ...formData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'locations'), { ...formData, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
      setEditingLocation(null);
      setFormData(EMPTY_FORM);
    } catch (err) {
      console.error('Error saving location:', err);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof EMPTY_FORM, placeholder: string, colSpan = false, textarea = false) => (
    <div className={`space-y-1.5 ${colSpan ? 'col-span-2' : ''}`}>
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</label>
      {textarea ? (
        <textarea
          required
          rows={2}
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
        />
      ) : (
        <input
          required
          type="text"
          value={formData[key]}
          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Centros Logísticos</h1>
          <p className="text-white/40 text-sm mt-1">{locations.length} centros registrados</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Añadir Centro
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar por nombre, región, dirección..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-white/30">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Cargando centros...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] border-b border-white/10">
                <tr>
                  <Th col="name" label="Centro" />
                  <Th col="region" label="Región" />
                  <Th col="postalCode" label="C.P." />
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Dirección</th>
                  <Th col="schedule" label="Horario" />
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(loc => (
                  <tr key={loc.id} className="hover:bg-white/[0.04] transition-colors group">
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-blue-500/15 rounded-lg flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        {loc.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">{loc.region || '—'}</td>
                    <td className="px-4 py-3 text-white/50 font-mono text-xs whitespace-nowrap">{loc.postalCode || '—'}</td>
                    <td className="px-4 py-3 text-white/50 max-w-xs truncate">{loc.address || '—'}</td>
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">{loc.schedule || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(loc)}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-white/20 italic text-sm">
                      No se encontraron centros logísticos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-overlay">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingLocation ? 'Editar Centro' : 'Nuevo Centro Logístico'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field('Nombre del Centro', 'name', 'Ej. Makro Leganés', true)}
                {field('Región / Ciudad', 'region', 'Ej. Madrid')}
                {field('Código Postal', 'postalCode', '28914')}
                {field('Dirección Completa', 'address', 'Calle, número, localidad...', true, true)}
                {field('Horario de Servicio', 'schedule', 'Ej. Lun–Vie 07:00–19:00', true)}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingLocation ? 'Guardar Cambios' : 'Crear Centro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
