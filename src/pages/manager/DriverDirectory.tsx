import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2, ChevronRight, Link, Check, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

type SortKey = 'name' | 'role' | 'status' | 'kmRate' | 'dni';

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-400',
  pending:  'bg-amber-500/10 text-amber-400',
  inactive: 'bg-white/5 text-white/30',
  rejected: 'bg-red-500/10 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', pending: 'Pendiente', inactive: 'Inactivo', rejected: 'Rechazado',
};

const ROLE_LABELS: Record<string, string> = {
  driver: 'Empleado',
  autonomo: 'Autónomo',
  company: 'Empresa',
  admin: 'Administrador',
  superadmin: 'S.Admin',
};

const DriverDirectory = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    if (!user) return;
    const inviteLink = `${window.location.origin}/register?companyId=${user.uid}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApprove = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'active' });
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  useEffect(() => {
    if (!user || !profile) return;

    let rolesToFetch = ['driver', 'autonomo'];
    if (profile.role === 'superadmin') {
      rolesToFetch = ['admin', 'company', 'driver', 'autonomo'];
    } else if (profile.role === 'admin') {
      rolesToFetch = ['company', 'driver', 'autonomo'];
    }

    let q;
    if (profile.role === 'company') {
      q = query(collection(db, 'users'), where('role', 'in', rolesToFetch), where('companyId', '==', user.uid));
    } else {
      q = query(collection(db, 'users'), where('role', 'in', rolesToFetch));
    }

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setDrivers(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile]);

  const filtered = useMemo(() => {
    let rows = drivers;

    if (statusFilter !== 'all') rows = rows.filter(d => d.status === statusFilter);

    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(d =>
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(s) ||
        (d.email || '').toLowerCase().includes(s) ||
        (d.dni || '').toLowerCase().includes(s)
      );
    }

    return [...rows].sort((a, b) => {
      let av: any, bv: any;
      switch (sort.key) {
        case 'name':       av = `${a.firstName} ${a.lastName}`; bv = `${b.firstName} ${b.lastName}`; break;
        case 'role':       av = a.role || ''; bv = b.role || ''; break;
        case 'status':     av = a.status || ''; bv = b.status || ''; break;
        case 'kmRate':     av = Number(a.kmRate) || 0; bv = Number(b.kmRate) || 0; break;
        case 'dni':        av = a.dni || ''; bv = b.dni || ''; break;
        default: av = ''; bv = '';
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [drivers, search, statusFilter, sort]);

  const counts = useMemo(() => ({
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    pending: drivers.filter(d => d.status === 'pending').length,
  }), [drivers]);

  const requestSort = (key: SortKey) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort.key !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sort.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => requestSort(col)}
      className={`px-4 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white/70 transition-colors whitespace-nowrap ${className}`}
    >
      <div className="flex items-center gap-1">{label}<SortIcon col={col} /></div>
    </th>
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <Helmet>
        <title>BTS Logistics Pro - Directorio de Conductores</title>
      </Helmet>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Directorio de Usuarios</h1>
          <p className="text-white/40 text-sm mt-1">{counts.total} usuarios · {counts.active} activos · {counts.pending} pendientes</p>
        </div>
        
        {profile?.role === 'company' && (
          <button 
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              copiedLink 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
            {copiedLink ? 'Enlace Copiado' : 'Copiar Enlace de Invitación'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o DNI..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-72 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {['all', 'active', 'pending', 'inactive'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-white/30">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Sincronizando usuarios...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] border-b border-white/10">
                <tr>
                  <Th col="name" label="Usuario" />
                  <th className="px-4 py-3 text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Email</th>
                  <Th col="dni" label="DNI / CIF" />
                  <Th col="role" label="Rol" />
                   <Th col="kmRate" label="€/km" />
                  <Th col="status" label="Estado" />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(driver => (
                  <tr
                    key={driver.id}
                    onClick={() => navigate(`/manager/drivers/${driver.id}`)}
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                          {(driver.firstName || '?').charAt(0)}{(driver.lastName || '').charAt(0)}
                        </div>
                        <span>{driver.firstName} {driver.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/50">{driver.email || '—'}</td>
                    <td className="px-4 py-3 text-white/60 font-mono text-xs">{driver.dni || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                        driver.role === 'admin' || driver.role === 'superadmin' ? 'bg-red-500/10 text-red-400' :
                        driver.role === 'company' ? 'bg-orange-500/10 text-orange-400' :
                        driver.role === 'autonomo' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {ROLE_LABELS[driver.role] || driver.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70 tabular-nums">
                      {driver.kmRate ? `${Number(driver.kmRate).toFixed(2)} €` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${STATUS_STYLES[driver.status] || 'bg-white/5 text-white/30'}`}>
                        {STATUS_LABELS[driver.status] || driver.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {driver.status === 'pending' && (
                          <button
                            onClick={(e) => handleApprove(e, driver.id)}
                            className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-colors"
                            title="Aprobar Usuario"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/60 transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-white/20 italic text-sm">
                      No se encontraron usuarios
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
};

export default DriverDirectory;
