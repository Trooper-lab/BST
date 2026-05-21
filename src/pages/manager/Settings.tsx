import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Trash2, AlertTriangle, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface CollectionConfig {
  id: string;
  label: string;
  description: string;
  warning: string;
  color: string;
}

const COLLECTIONS: CollectionConfig[] = [
  {
    id: 'routes',
    label: 'Rutas',
    description: 'Todos los registros de rutas completadas, activas y canceladas.',
    warning: 'Esto eliminará permanentemente el historial de rutas. No se puede deshacer.',
    color: 'blue',
  },
  {
    id: 'emergencies',
    label: 'Emergencias',
    description: 'Todos los reportes de incidencias y emergencias enviados por conductores.',
    warning: 'Se eliminarán todos los reportes de emergencia. No se puede deshacer.',
    color: 'orange',
  },
  {
    id: 'invoices',
    label: 'Facturas',
    description: 'Todos los documentos de facturación generados.',
    warning: 'Se eliminarán todas las facturas emitidas. No se puede deshacer.',
    color: 'purple',
  },
  {
    id: 'invoiceGroups',
    label: 'Grupos de Factura',
    description: 'Agrupaciones y consolidaciones de facturas.',
    warning: 'Se eliminarán todos los grupos de factura. No se puede deshacer.',
    color: 'purple',
  },
];

interface DeleteState {
  open: boolean;
  confirmText: string;
  loading: boolean;
  result: { count: number } | null;
  error: string | null;
}

const initialDeleteState = (): DeleteState => ({
  open: false,
  confirmText: '',
  loading: false,
  result: null,
  error: null,
});

async function deleteCollection(collectionId: string): Promise<number> {
  const snap = await getDocs(collection(db, collectionId));
  if (snap.empty) return 0;

  // Firestore batch limit is 500 operations
  const CHUNK = 500;
  const docs = snap.docs;
  let deleted = 0;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(doc(db, collectionId, d.id)));
    await batch.commit();
    deleted += Math.min(CHUNK, docs.length - i);
  }

  return deleted;
}

function colorClasses(color: string, variant: 'bg' | 'border' | 'text' | 'ring') {
  const map: Record<string, Record<string, string>> = {
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   ring: 'ring-blue-500/40' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/40' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', ring: 'ring-purple-500/40' },
  };
  return map[color]?.[variant] ?? '';
}

export default function Settings() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [states, setStates] = useState<Record<string, DeleteState>>(() =>
    Object.fromEntries(COLLECTIONS.map(c => [c.id, initialDeleteState()]))
  );

  if (profile?.role !== 'superadmin') {
    navigate('/manager/dashboard');
    return null;
  }

  const update = (id: string, patch: Partial<DeleteState>) =>
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const toggleOpen = (id: string) => {
    const current = states[id];
    if (current.open) {
      update(id, initialDeleteState());
    } else {
      update(id, { open: true, confirmText: '', result: null, error: null });
    }
  };

  const handleDelete = async (col: CollectionConfig) => {
    if (states[col.id].confirmText !== 'DELETE') return;
    update(col.id, { loading: true, error: null });
    try {
      const count = await deleteCollection(col.id);
      update(col.id, { loading: false, result: { count }, confirmText: '', open: false });
    } catch (err: any) {
      update(col.id, { loading: false, error: err?.message || 'Error al eliminar.' });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <Helmet>
        <title>BTS Logistics Pro - Configuración</title>
      </Helmet>

      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="text-white/40 text-sm mt-1">Herramientas de administración del sistema</p>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/20 overflow-hidden">
        <div className="px-6 py-4 bg-red-500/5 border-b border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-red-400">Zona Peligrosa</h2>
            <p className="text-xs text-white/30 mt-0.5">Estas acciones son irreversibles. Úsalas con extremo cuidado.</p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {COLLECTIONS.map(col => {
            const s = states[col.id];
            return (
              <div key={col.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${colorClasses(col.color, 'bg')} ${colorClasses(col.color, 'text')}`}>
                        {col.id}
                      </span>
                      <h3 className="text-sm font-semibold text-white">{col.label}</h3>
                    </div>
                    <p className="text-xs text-white/40">{col.description}</p>

                    {/* Success message */}
                    {s.result && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {s.result.count} documento{s.result.count !== 1 ? 's' : ''} eliminado{s.result.count !== 1 ? 's' : ''} correctamente.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleOpen(col.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar Todo
                    {s.open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Confirmation panel */}
                {s.open && (
                  <div className="mt-4 p-4 bg-red-950/30 border border-red-500/20 rounded-xl space-y-3">
                    <div className="flex items-start gap-2 text-xs text-red-300">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {col.warning}
                    </div>

                    <div>
                      <label className="block text-[11px] text-white/40 mb-1.5">
                        Escribe <span className="font-mono font-bold text-red-400">DELETE</span> para confirmar:
                      </label>
                      <input
                        type="text"
                        value={s.confirmText}
                        onChange={e => update(col.id, { confirmText: e.target.value, error: null })}
                        placeholder="DELETE"
                        className="w-full bg-slate-900 border border-red-500/30 rounded-lg py-2 px-3 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder:text-white/20"
                        disabled={s.loading}
                      />
                    </div>

                    {s.error && (
                      <p className="text-xs text-red-400">{s.error}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDelete(col)}
                        disabled={s.confirmText !== 'DELETE' || s.loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
                      >
                        {s.loading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eliminando...</>
                        ) : (
                          <><Trash2 className="w-3.5 h-3.5" /> Confirmar Eliminación</>
                        )}
                      </button>
                      <button
                        onClick={() => toggleOpen(col.id)}
                        disabled={s.loading}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
