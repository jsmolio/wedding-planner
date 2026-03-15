import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWedding } from '@/contexts/WeddingContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { wedding } = useWedding();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5" />
        </button>
        {wedding && (
          <span className="text-sm text-gray-500">
            {wedding.partner1_name} & {wedding.partner2_name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600 hidden sm:block">{user?.email}</span>
        <button
          onClick={signOut}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
