import { Clock, LogOut, MessageSquare } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function PendingApproval() {
  const { profile, setUser, setProfile } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <Helmet>
        <title>BTS Logistics Pro - Cuenta Pendiente</title>
      </Helmet>

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      
      <div className="max-w-md w-full glass p-8 rounded-3xl text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-blue-500 animate-pulse" />
        </div>
        
        <div>
          <h1 className="text-2xl font-bold mb-2">Cuenta en Revisión</h1>
          <p className="text-gray-400">
            Hola, <span className="text-white font-medium">{profile?.firstName}</span>. Tu cuenta ha sido creada correctamente, pero debe ser activada por un administrador antes de que puedas empezar a trabajar.
          </p>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-2xl border border-gray-700 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600/20 rounded flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-400">1</span>
            </div>
            <p className="text-xs text-gray-300">Un administrador revisará tus datos (DNI/CIF).</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600/20 rounded flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-400">2</span>
            </div>
            <p className="text-xs text-gray-300">Recibirás una notificación o podrás acceder en 24-48h.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all"
          >
            Comprobar Estado
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white py-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>

        <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
          <MessageSquare className="w-3 h-3" />
          ¿Necesitas ayuda? Contacta con bts@soporte.es
        </p>
      </div>
    </div>
  );
}
