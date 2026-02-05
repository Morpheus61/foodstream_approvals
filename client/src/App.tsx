import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import LoginPage from '@/pages/LoginPage';
import TrialSignupPage from '@/pages/TrialSignupPage';
import LicenseActivationPage from '@/pages/LicenseActivationPage';
import DashboardLayout from '@/pages/DashboardLayout';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/trial"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <TrialSignupPage />}
        />
        <Route
          path="/activate"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LicenseActivationPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard/*"
          element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}
        />

        {/* Default Redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
