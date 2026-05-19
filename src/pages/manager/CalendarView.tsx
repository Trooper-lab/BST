import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, ChevronRight, Plus, Clock, Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const CalendarView = () => {
  const [routes, setRoutes] = useState<any[]>([]);
  const now = new Date();
  const days = Array.from({ length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    const q = query(collection(db, 'routes'), orderBy('startTime', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getRoutesForDay = (day: number) => {
    return routes.filter(r => {
      if (!r.startTime) return false;
      const d = r.startTime.toDate();
      return d.getDate() === day && d.getMonth() === now.getMonth();
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Helmet>
        <title>BTS Logistics Pro - Calendario de Operaciones</title>
      </Helmet>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Operations Calendar</h1>
          <p className="text-blue-200/60 mt-1">Manage driver shifts, holidays, and route planning</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">October 2026</h2>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="px-3 py-1 bg-white/5 rounded-lg text-xs font-medium text-white">Today</button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-7 mb-4">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-bold text-blue-400 uppercase tracking-wider pb-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
              {days.map(day => {
                const dayRoutes = getRoutesForDay(day);
                const isToday = day === now.getDate();
                
                return (
                  <div 
                    key={day} 
                    className={`min-h-[120px] bg-[#0a0f1d] p-3 hover:bg-white/[0.02] transition-colors relative group ${isToday ? 'bg-blue-500/5' : ''}`}
                  >
                    <span className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-white/40'}`}>
                      {day}
                    </span>
                    
                    {dayRoutes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                          <p className="text-[10px] text-blue-400 font-medium leading-none">{dayRoutes.length} Route{dayRoutes.length > 1 ? 's' : ''}</p>
                          <p className="text-[8px] text-blue-300/40 mt-0.5">
                            {dayRoutes.reduce((acc, r) => acc + (r.totalDeliveries || 0), 0)} Deliveries
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Upcoming Events
            </h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="w-1 rounded-full bg-blue-500/50" />
                  <div>
                    <p className="text-sm font-medium text-white">Route Optimization Review</p>
                    <p className="text-xs text-white/40 mt-0.5">Tomorrow, 10:00 AM</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Staff on Leave
            </h3>
            <div className="space-y-4">
              {['Juan P.', 'Maria S.'].map(name => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white">
                      {name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-white/80">{name}</span>
                  </div>
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Holiday</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
