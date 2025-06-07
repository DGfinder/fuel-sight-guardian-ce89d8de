import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Bell, PlusCircle, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Alerts', icon: Bell, to: '/alerts' },
  { label: 'Add Dip', icon: PlusCircle, to: '/add-dip' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

export function StickyMobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  // Only show on mobile
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t flex justify-around items-center h-16 md:hidden shadow-lg">
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.to;
        const Icon = item.icon;
        return (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className={`flex flex-col items-center justify-center flex-1 h-full focus:outline-none ${active ? 'text-[#008457]' : 'text-gray-400'}`}
            aria-label={item.label}
          >
            <Icon className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
} 