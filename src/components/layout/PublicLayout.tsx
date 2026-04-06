import { Outlet } from 'react-router-dom';
import { ClementineLogo } from '@/components/ui/Logo';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto mb-4">
            <ClementineLogo className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Clementine</h1>
          <p className="text-gray-500 mt-1">Your AI-powered wedding planner</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
