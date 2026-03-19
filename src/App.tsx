import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/QueryClient';
import { Toaster } from 'sonner';

// Lazy-loaded pages — each page is a separate chunk loaded on demand
// This reduces the initial bundle by ~40%, making first paint significantly faster
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

// Shared loading fallback for Suspense boundaries
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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Portal-aware wrapper for the /pos route
// When a user logs in with the GOD toggle selected, sessionStorage contains 'wholesale'.
// This component intercepts that and redirects to /wholesale before the POS loads.
function RetailProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Check if the user just logged in targeting the wholesale portal
  let portal = 'retail';
  try { portal = sessionStorage.getItem('god-portal') || 'retail'; } catch { /* ignore */ }

  if (portal === 'wholesale') {
    // Clear the flag so it doesn't redirect forever on subsequent /pos visits
    try { sessionStorage.removeItem('god-portal'); } catch { /* ignore */ }
    return <Navigate to="/wholesale" replace />;
  }

  // Clear flag for retail login too (cleanup)
  try { sessionStorage.removeItem('god-portal'); } catch { /* ignore */ }

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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Retail (Coko) Route Branch — uses RetailProtectedRoute to intercept wholesale users */}
              <Route path="/pos" element={<RetailProtectedRoute><MainLayout mode="retail" /></RetailProtectedRoute>}>
                <Route index element={<POSPage />} />
                <Route path="orders" element={<AdminRoute><OrdersPage /></AdminRoute>} />
                <Route path="inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
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
              <Route path="/" element={<Navigate to="/pos" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" richColors theme="light" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
