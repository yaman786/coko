import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/QueryClient';
import { Toaster } from 'sonner';

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const POSPage = lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WholesaleDashboard = lazy(() => import('./pages/wholesale/WholesaleDashboard'));
const WholesaleInventoryPage = lazy(() => import('./pages/wholesale/WholesaleInventoryPage'));
const ClientsPage = lazy(() => import('./pages/wholesale/ClientsPage'));
const WholesaleOrdersPage = lazy(() => import('./pages/wholesale/WholesaleOrdersPage'));
const ProductAnalyticsPage = lazy(() => import('./pages/ProductAnalyticsPage').then(m => ({ default: m.ProductAnalyticsPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      <p className="text-sm text-slate-400 font-medium tracking-tight">Loading...</p>
    </div>
  );
}

// Higher Order Component to protect routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!session) {
    // Industry Standard: Redirect to login with the current path as a return-to parameter
    // But for this app, we'll keep it simple and just go to login.
    // The LoginPage toggle will naturally handle the 'to' parameter.
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Higher Order Component to restrict access to Admins only
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (role !== 'admin') {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

// Helper to get/set cookies for portal intent (more robust than localStorage during redirects)
const intentCookie = {
  get: () => {
    const match = document.cookie.match(/(^| )portal_intent=([^;]+)/);
    return match ? match[2] : null;
  },
  set: (val: string) => {
    document.cookie = `portal_intent=${val}; path=/; max-age=600; SameSite=Lax`;
  },
  clear: () => {
    document.cookie = "portal_intent=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
};

// Central Dispatcher for the Root Path — The Professional Standard
function AppDispatcher() {
  const { session, loading } = useAuth();
  
  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;

  const intent = intentCookie.get();
  
  // Clear intent after reading to avoid "sticky" behavior
  if (intent) {
    intentCookie.clear();
    if (intent === 'wholesale') {
      return <Navigate to="/wholesale" replace />;
    }
  }

  // Fallback: Check if they are already on a wholesale path or default to POS
  return <Navigate to="/pos" replace />;
}

// Interceptor to catch cases where a hardcoded redirect from Supabase lands on /pos
function PosInterceptor({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;

  const intent = intentCookie.get();
  if (intent === 'wholesale') {
    intentCookie.clear();
    return <Navigate to="/wholesale" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Retail (Coko) Route Branch - Intercepts wholesale intent if landed here */}
              <Route path="/pos" element={<PosInterceptor><MainLayout mode="retail" /></PosInterceptor>}>
                <Route index element={<POSPage />} />
                <Route path="orders" element={<AdminRoute><OrdersPage /></AdminRoute>} />
                <Route index={false} path="inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
                <Route path="suppliers" element={<AdminRoute><SuppliersPage /></AdminRoute>} />
                <Route path="expenses" element={<AdminRoute><ExpensesPage /></AdminRoute>} />
                <Route path="dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
                <Route path="analytics" element={<AdminRoute><ProductAnalyticsPage /></AdminRoute>} />
                <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              </Route>

              {/* Wholesale (GOD) Route Branch */}
              <Route path="/wholesale" element={<ProtectedRoute><MainLayout mode="wholesale" /></ProtectedRoute>}>
                 <Route index element={<Navigate to="dashboard" replace />} />
                 <Route path="dashboard" element={<AdminRoute><WholesaleDashboard /></AdminRoute>} />
                 <Route path="inventory" element={<AdminRoute><WholesaleInventoryPage /></AdminRoute>} />
                 <Route path="clients" element={<AdminRoute><ClientsPage /></AdminRoute>} />
                 <Route path="orders" element={<AdminRoute><WholesaleOrdersPage /></AdminRoute>} />
                 <Route path="suppliers" element={<AdminRoute><SuppliersPage /></AdminRoute>} />
                 <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              </Route>

              {/* Fallback & Root Redirects */}
              <Route path="/" element={<AppDispatcher />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" richColors theme="light" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
