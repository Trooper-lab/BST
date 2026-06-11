import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Truck, BarChart3, AlertTriangle, LogOut, User, Clock } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';

export default function DriverLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, setUser, setProfile, activeRoute, setActiveRoute } = useAuthStore();
  const [duration, setDuration] = useState<string | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakCountdown, setBreakCountdown] = useState<string | null>(null);
  const isUpdating = useRef(false);

  useEffect(() => {
    if (!activeRoute?.startTime) {
      setDuration(null);
      setIsOnBreak(false);
      setBreakCountdown(null);
      return;
    }

    const parseDate = (val: any) => {
      if (!val) return null;
      if (val.toDate) return val.toDate();
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const start = parseDate(activeRoute.startTime);
    const breakStart = activeRoute.lunchStartTime ? parseDate(activeRoute.lunchStartTime) : null;
    const breakLimit = activeRoute.lunchLimit || 60;
    
    if (!start) {
      setDuration('...');
      return;
    }
    
    const updateTimer = async () => {
      const now = new Date();
      let lunchMs = (activeRoute.lunchMinutesUsed || 0) * 60000;
      let breakActive = false;
      let countdown = null;

      if (breakStart) {
        const breakElapsed = now.getTime() - breakStart.getTime();
        const limitMs = breakLimit * 60000;
        
        if (breakElapsed > 0 && breakElapsed < limitMs) {
          // Current break is active
          lunchMs += breakElapsed;
          breakActive = true;
          
          const remainingMs = limitMs - breakElapsed;
          const remMin = Math.floor(remainingMs / 60000);
          const remSec = Math.floor((remainingMs % 60000) / 1000);
          countdown = `${remMin}:${remSec.toString().padStart(2, '0')}`;
        } else if (breakElapsed >= limitMs) {
          // Current break ended - AUTO RESET
          lunchMs += limitMs;
          breakActive = false;
          
          if (!isUpdating.current && activeRoute.lunchStartTime) {
            isUpdating.current = true;
            try {
              const newUsed = (activeRoute.lunchMinutesUsed || 0) + breakLimit;
              await updateDoc(doc(db, 'routes', activeRoute.id), {
                lunchStartTime: null,
                lunchLimit: 0,
                lunchMinutesUsed: newUsed
              });
              setActiveRoute({
                ...activeRoute,
                lunchStartTime: null,
                lunchLimit: 0,
                lunchMinutesUsed: newUsed
              });
            } catch (err) {
              console.error("Auto-reset break error:", err);
            } finally {
              isUpdating.current = false;
            }
          }
        }
      }

      setIsOnBreak(breakActive);
      setBreakCountdown(countdown);
      const diff = Math.max(0, now.getTime() - start.getTime() - lunchMs);
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeRoute?.startTime, activeRoute?.lunchStartTime, activeRoute?.lunchLimit, setActiveRoute]);

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const navItems = [
    { icon: Truck, label: 'Reparto', path: '/driver/start' },
    { icon: BarChart3, label: 'Stats', path: '/driver/stats' },
    { icon: User, label: 'Perfil', path: '/driver/profile' },
    { icon: AlertTriangle, label: 'SOS', path: '/driver/emergency', color: 'text-red-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-24">
      {/* Header */}
      <header className="glass p-4 sticky top-0 z-10 flex items-center justify-between">
        <button 
          onClick={() => navigate('/driver/profile')}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Conductor</p>
            <h2 className="font-bold text-sm leading-tight">
              {profile?.firstName} {profile?.lastName}
            </h2>
          </div>
        </button>

        {duration && (
          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-full transition-all ${
              isOnBreak 
                ? 'bg-amber-500/20 border-amber-500/40' 
                : 'bg-blue-600/20 border-blue-500/30'
            }`}>
              <Clock className={`w-3.5 h-3.5 animate-pulse ${isOnBreak ? 'text-amber-400' : 'text-blue-400'}`} />
              <div className="flex flex-col items-start leading-none">
                {isOnBreak ? (
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black text-amber-400 uppercase tracking-tighter mb-0.5">
                      FIN DESCANSO IN
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                      {breakCountdown}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-mono font-bold text-blue-400 tabular-nums">
                    {duration}
                  </span>
                )}
              </div>
            </div>
            {!isOnBreak && activeRoute?.lunchMinutesUsed > 0 && (
              <span className="text-[8px] font-bold text-gray-500 uppercase">
                Break restante: {Math.max(0, 60 - (activeRoute.lunchMinutesUsed || 0))} min
              </span>
            )}
            {!activeRoute?.lunchStartTime && !activeRoute?.lunchMinutesUsed && (
              <span className="text-[8px] font-bold text-blue-400/60 uppercase">
                Break: 60m disp.
              </span>
            )}
          </div>
        )}

        <button 
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 animate-fade-in">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass rounded-2xl p-2 flex justify-around items-center shadow-2xl shadow-blue-900/20 z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/driver/start' && location.pathname === '/driver/end');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                isActive ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-gray-400'
              }`}
            >
              <item.icon className={`w-6 h-6 ${item.color && !isActive ? item.color : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
