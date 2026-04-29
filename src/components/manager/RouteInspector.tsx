import { useEffect } from 'react';
import { X, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Props {
  route: any;
  onClose: () => void;
  users?: Record<string, string>;
}

export default function RouteInspector({ route, onClose, users = {} }: Props) {
  const navigate = useNavigate();

  const getMs = (val: any) => {
    if (!val) return 0;
    if (val.toDate) return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startMs = getMs(route.startTime);
  const endMs = getMs(route.endTime);
  const driverName = route.driverName || users[route.driverId] || 'Conductor';
  const totalKm = route.endTime ? (Number(route.endKm) || 0) - (Number(route.startKm) || 0) : null;
  const isActive = !route.endTime;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-overlay"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 font-bold text-xl border border-blue-500/20">
              {driverName.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{driverName}</h3>
              <p className="text-[10px] text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {route.id?.slice(0, 12)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Estado</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                <span className="text-sm font-bold text-white">{isActive ? 'En Curso' : 'Completada'}</span>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Distancia</p>
              <span className="text-sm font-bold text-white">{totalKm !== null ? `${totalKm.toFixed(1)} KM` : '---'}</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Ayudante</p>
              <span className={`text-sm font-bold ${route.hasHelper ? 'text-emerald-400' : 'text-white/40'}`}>
                {route.hasHelper ? 'Activado' : 'No'}
              </span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Repartos</p>
              <span className="text-sm font-bold text-white">{route.totalDeliveries ?? '---'}</span>
            </div>
          </div>

          {/* Active: time elapsed */}
          {isActive && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase">En tránsito desde hace</p>
                <p className="text-sm font-bold text-white">
                  {startMs ? formatDistanceToNow(new Date(startMs), { locale: es }) : 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Journey timeline */}
          <div className="relative space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
            {/* Start */}
            <div className="relative pl-10">
              <div className="absolute left-0 top-1 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/40">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              <p className="text-[10px] font-bold text-blue-400 uppercase">Inicio de Ruta</p>
              <p className="text-base font-bold text-white">{route.startCenter || 'Origen'}</p>
              <p className="text-xs text-white/40 italic">
                {startMs ? format(new Date(startMs), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : 'N/A'}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">KM Inicial: {route.startKm ?? '---'}</p>
            </div>

            {/* Planned destination (active routes with endCenter but no endTime) */}
            {isActive && route.endCenter && (
              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 border-dashed">
                  <ArrowRight className="w-3 h-3 text-blue-400" />
                </div>
                <p className="text-[10px] font-bold text-blue-400/60 uppercase">Destino Previsto</p>
                <p className="text-base font-bold text-white/60">{route.endCenter}</p>
              </div>
            )}

            {/* End (completed routes) */}
            {!isActive && (
              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/40">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                </div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Fin de Ruta</p>
                <p className="text-base font-bold text-white">{route.endCenter || route.endLocation?.name || 'Destino'}</p>
                <p className="text-xs text-white/40 italic">
                  {endMs ? format(new Date(endMs), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : 'N/A'}
                </p>
                <p className="text-[10px] text-white/20 mt-0.5">KM Final: {route.endKm ?? '---'}</p>
              </div>
            )}
          </div>

          {/* Photos */}
          {(route.startPhoto || route.endPhoto) && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Evidencia Fotográfica</p>
              <div className="grid grid-cols-2 gap-3">
                {route.startPhoto && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase">Odómetro Inicial</p>
                    <div
                      className="aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/10 cursor-pointer group"
                      onClick={() => window.open(route.startPhoto)}
                    >
                      <img src={route.startPhoto} alt="Inicio" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  </div>
                )}
                {route.endPhoto && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase">Odómetro Final</p>
                    <div
                      className="aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/10 cursor-pointer group"
                      onClick={() => window.open(route.endPhoto)}
                    >
                      <img src={route.endPhoto} alt="Final" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-white/5 shrink-0">
          <button
            onClick={() => navigate(`/manager/drivers/${route.driverId}`)}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
          >
            Ver Perfil del Conductor
          </button>
        </div>
      </div>
    </>
  );
}
