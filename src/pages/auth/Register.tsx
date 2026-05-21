import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Lock, Loader2, ChevronLeft, Building2, AlertCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '../../store/useAuthStore';

type Role = 'driver' | 'autonomo' | 'company';

export default function Register() {
  const [role, setRole] = useState<Role>('driver');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('companyId');
  const { setUser, setProfile } = useAuthStore();

  React.useEffect(() => {
    if (companyId) {
      getDoc(doc(db, 'users', companyId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.role === 'company') {
            setCompanyName(`${data.firstName} ${data.lastName}`.trim());
          }
        }
      });
      // Invite links are always for drivers/autónomos, never company accounts
      setRole(r => r === 'company' ? 'driver' : r);
    }
  }, [companyId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const profileData = {
        uid: user.uid,
        email,
        firstName,
        lastName,
        role,
        status: 'pending',
        createdAt: new Date().toISOString(),
        dni,
        ...(companyId ? { companyId } : {}),
      };

      await setDoc(doc(db, 'users', user.uid), profileData);

      // Sign-in already happened via createUserWithEmailAndPassword — update the store
      // so the app picks up the pending profile without requiring a second login.
      setProfile(profileData);
      setUser(user);

      navigate('/pending');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado. ¿Olvidaste tu contraseña?');
      } else if (code === 'auth/invalid-email') {
        setError('El formato del email no es válido.');
      } else if (code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil. Usa al menos 6 caracteres.');
      } else {
        setError(err.message || 'Error al crear la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0f172a] relative overflow-hidden">
      <Helmet>
        <title>BTS Logistics Pro - Registro</title>
      </Helmet>

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-xl glass p-8 rounded-3xl animate-fade-in relative">
        <button
          onClick={() => navigate('/login')}
          className="absolute left-6 top-6 text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás
        </button>

        <div className="flex flex-col items-center mb-8 pt-4">
          <h1 className="text-3xl font-bold gradient-text">Crear Cuenta</h1>
          {companyName ? (
            <div className="mt-4 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <p className="text-blue-400 text-sm font-medium">
                Registro de Conductor para <strong className="text-white">{companyName}</strong>
              </p>
            </div>
          ) : (
            <p className="text-gray-400 mt-2">Únete a la red logística de BTS</p>
          )}
        </div>

        {/* Role selector — hide Company option on company invite links */}
        <div className="flex bg-slate-800/50 p-1 rounded-2xl mb-8">
          {(companyId ? (['driver', 'autonomo'] as Role[]) : (['driver', 'autonomo', 'company'] as Role[])).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                role === r ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              {r === 'driver' ? 'Conductor' : r === 'autonomo' ? 'Autónomo' : 'Empresa'}
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="ejemplo@bts.es"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Apellidos</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">DNI / NIE / CIF</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={dni}
                onChange={e => setDni(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Repetir Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="md:col-span-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrarse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
