import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWedding } from '@/contexts/WeddingContext';
import { ClementineLogo } from '@/components/ui/Logo';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: weddingLoading, weddingId } = useWedding();

  if (authLoading || weddingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto animate-pulse">
            <ClementineLogo className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!weddingId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto animate-pulse">
            <ClementineLogo className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500">Setting up your wedding...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
