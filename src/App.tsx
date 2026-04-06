import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { WeddingProvider } from '@/contexts/WeddingContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RsvpPublicPage } from '@/components/rsvp/RsvpPublicPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import GuestsPage from '@/pages/GuestsPage';
import RsvpPage from '@/pages/RsvpPage';
import VenuesPage from '@/pages/VenuesPage';
import SeatingPage from '@/pages/SeatingPage';
import BudgetPage from '@/pages/BudgetPage';
import ChecklistPage from '@/pages/ChecklistPage';
import SettingsPage from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <WeddingProvider>
            <Routes>
              {/* Public auth routes */}
              <Route element={<PublicLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              {/* Public RSVP page */}
              <Route path="/rsvp/:token" element={<RsvpPublicPage />} />

              {/* Protected app routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/rsvp-manager" element={<RsvpPage />} />
                <Route path="/venues" element={<VenuesPage />} />
                <Route path="/seating" element={<SeatingPage />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/checklist" element={<ChecklistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </WeddingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
