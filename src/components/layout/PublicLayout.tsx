import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 text-primary-500 fill-primary-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Wedding Planner</h1>
          <p className="text-gray-500 mt-1">Plan your perfect day together</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
