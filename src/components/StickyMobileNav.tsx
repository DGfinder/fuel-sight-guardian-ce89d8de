import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Bell, PlusCircle, Settings, Map, BarChart3 } from 'lucide-react';
import { useTouchGestures } from '@/hooks/useTouchGestures';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Map', icon: Map, to: '/map' },
  { label: 'Tanks', icon: BarChart3, to: '/tanks' },
  { label: 'Alerts', icon: Bell, to: '/alerts' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

export function StickyMobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  // Add swipe gestures for navigation
  const { attachListeners } = useTouchGestures({
    onSwipeLeft: () => {
      const currentIndex = NAV_ITEMS.findIndex(item => item.to === location.pathname);
      const nextIndex = Math.min(currentIndex + 1, NAV_ITEMS.length - 1);
      if (nextIndex !== currentIndex) {
        navigate(NAV_ITEMS[nextIndex].to);
      }
    },
    onSwipeRight: () => {
      const currentIndex = NAV_ITEMS.findIndex(item => item.to === location.pathname);
      const prevIndex = Math.max(currentIndex - 1, 0);
      if (prevIndex !== currentIndex) {
        navigate(NAV_ITEMS[prevIndex].to);
      }
    },
    enableSwipe: true,
    threshold: 80,
  });

  useEffect(() => {
    if (navRef.current) {
      return attachListeners(navRef.current);
    }
  }, [attachListeners]);

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t dark:border-gray-700 flex justify-around items-center h-16 md:hidden shadow-lg touch-manipulation"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {NAV_ITEMS.map((item, index) => {
        const active = location.pathname === item.to;
        const Icon = item.icon;
        return (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className={`
              flex flex-col items-center justify-center flex-1 h-full
              focus:outline-none transition-all duration-200
              active:scale-95 active:bg-gray-50 dark:active:bg-gray-800
              ${active ? 'text-[#008457]' : 'text-gray-400 dark:text-gray-500'}
            `}
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
            }}
            aria-label={item.label}
          >
            <Icon className={`w-5 h-5 mb-1 transition-transform ${active ? 'scale-110' : ''}`} />
            <span className={`text-xs font-medium transition-all ${active ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {active && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#008457] rounded-b-full" />
            )}
          </button>
        );
      })}

      {/* Swipe hint indicator */}
      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </nav>
  );
} 