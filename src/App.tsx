import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import DriverLayout from './components/layout/DriverLayout';
import ManagerLayout from './components/layout/ManagerLayout';
import StartRoute from './pages/driver/StartRoute';
import EndRoute from './pages/driver/EndRoute';
import Emergency from './pages/driver/Emergency';
import DriverStats from './pages/driver/DriverStats';
import UserProfile from './pages/driver/UserProfile';
import Dashboard from './pages/manager/Dashboard';
import DriverDirectory from './pages/manager/DriverDirectory';
import DriverProfile from './pages/manager/DriverProfile';
import MapView from './pages/manager/MapView';
import CalendarView from './pages/manager/CalendarView';
import ExcelView from './pages/manager/ExcelView';
import LocationsView from './pages/manager/LocationsView';
import LocationDetail from './pages/manager/LocationDetail';
import PendingApproval from './pages/auth/PendingApproval';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from './store/useAuthStore';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, profile, isLoading } = useAuthStore();
  
  if (isLoading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  
  // Handle account status
  if (profile?.status === 'pending') {
    return <Navigate to="/pending" />;
  }
  
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'driver' || profile.role === 'autonomo' ? '/driver' : '/manager/dashboard'} />;
  }
  
  return <>{children}</>;
};

function App() {
  const { setUser, setProfile, setIsLoading, setActiveRoute } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          let profile: any = null;
          if (profileDoc.exists()) {
            profile = profileDoc.data();
            setProfile(profile);
          } else if (user.email?.toLowerCase() === 'manager@test.es') {
            profile = { role: 'admin', status: 'active', firstName: 'Manager', lastName: 'Test' };
            setProfile(profile);
          }

          // Restore active route for drivers on session resume
          if (profile?.role === 'driver' || profile?.role === 'autonomo') {
            const routeSnap = await getDocs(
              query(collection(db, 'routes'), where('driverId', '==', user.uid), where('status', '==', 'active'))
            );
            if (!routeSnap.empty) {
              const routeDoc = routeSnap.docs[0];
              setActiveRoute({ id: routeDoc.id, ...routeDoc.data() });
            }
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
          if (user.email?.toLowerCase() === 'manager@test.es') {
            setProfile({ role: 'admin', status: 'active', firstName: 'Manager', lastName: 'Test' });
          }
        }
        setUser(user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<PendingApproval />} />

      {/* Driver Routes */}
      <Route path="/driver" element={
        <ProtectedRoute allowedRoles={['driver', 'autonomo']}>
          <DriverLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/driver/start" />} />
        <Route path="start" element={<StartRoute />} />
        <Route path="end" element={<EndRoute />} />
        <Route path="emergency" element={<Emergency />} />
        <Route path="stats" element={<DriverStats />} />
        <Route path="profile" element={<UserProfile />} />
      </Route>

      {/* Manager Routes */}
      <Route path="/manager" element={
        <ProtectedRoute allowedRoles={['admin', 'employee']}>
          <ManagerLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/manager/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="drivers" element={<DriverDirectory />} />
        <Route path="drivers/:id" element={<DriverProfile />} />
        <Route path="map" element={<MapView />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="excel" element={<ExcelView />} />
        <Route path="locations" element={<LocationsView />} />
        <Route path="locations/:id" element={<LocationDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
