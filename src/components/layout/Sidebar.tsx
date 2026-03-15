import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, MapPin, UtensilsCrossed, Mail,
  DollarSign, CheckSquare, Heart, Settings, X,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/guests', icon: Users, label: 'Guests' },
  { to: '/rsvp-manager', icon: Mail, label: 'RSVPs' },
  { to: '/venues', icon: MapPin, label: 'Venues' },
  { to: '/seating', icon: UtensilsCrossed, label: 'Seating' },
  { to: '/budget', icon: DollarSign, label: 'Budget' },
  { to: '/checklist', icon: CheckSquare, label: 'Checklist' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary-500 fill-primary-500" />
            <span className="text-lg font-bold text-gray-900">Wedding Planner</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
