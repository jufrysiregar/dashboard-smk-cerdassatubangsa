import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import MaintenancePage from './pages/MaintenancePage';
import SleepModePage from './pages/SleepModePage';
import { Toaster, toast } from 'react-hot-toast';
import { resolveLegacyExecutivePath } from './utils/executiveDashboard';

// Notif error/gagal tidak boleh menumpuk: semua error memakai satu `id` slot ('app-error'),
// sehingga react-hot-toast cukup memperbarui satu toast — tidak pernah "melayang banyak ke atas".
const _baseToastError = toast.error.bind(toast);
toast.error = (message, options = {}) =>
  _baseToastError(message, { ...options, id: options.id ?? 'app-error' });

// Fallback URL lama /dashboard/executive/:tab -> route 2-slash baru (tanpa link mati / 404).
function ExecutiveLegacyRedirect() {
  const params = useParams();
  return <Navigate to={resolveLegacyExecutivePath(params['*'])} replace />;
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Public Route Component (redirect if already logged in)
function PublicRoute({ children }) {
  const token = sessionStorage.getItem('token');
  
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  return (
    <Router>
      <Toaster position="bottom-right" reverseOrder={false} containerStyle={{ zIndex: 100000 }} />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/daftar"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/lupa-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/sleep-mode" element={<SleepModePage />} />

        {/* Legacy executive URL -> redirect ke route 2-slash baru */}
        <Route path="/dashboard/executive" element={<ExecutiveLegacyRedirect />} />
        <Route path="/dashboard/executive/*" element={<ExecutiveLegacyRedirect />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Not Found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
