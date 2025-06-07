
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Building2, MapPin, Settings, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Swan Transit', href: '/swan-transit', icon: Building2 },
  { name: 'Kalgoorlie', href: '/kalgoorlie', icon: MapPin },
  { name: 'Geraldton', href: '/geraldton', icon: MapPin },
  { name: 'GSF Depots', href: '/gsf-depots', icon: Building2 },
  { name: 'BGC', href: '/bgc', icon: Building2 },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 shadow-sm">
        {/* Logo and Title */}
        <div className="flex items-center flex-shrink-0 px-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#008457] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🚛</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Fuel Sight</h1>
              <p className="text-sm text-gray-600 font-medium">Guardian</p>
            </div>
          </div>
        </div>

        {/* Add Dip Reading CTA */}
        <div className="px-6 py-4">
          <Button 
            className="w-full bg-[#008457] hover:bg-[#008457]/90 text-white border-0 shadow-sm"
            onClick={() => {/* Add dip modal logic */}}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Dip Reading
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 pb-4 space-y-1">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-[#008457]/10 text-[#008457] border border-[#008457]/20'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-[#008457]'
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-3 h-5 w-5 transition-colors',
                      isActive ? 'text-[#008457]' : 'text-gray-500 group-hover:text-[#008457]'
                    )}
                  />
                  {item.name}
                  {isActive && (
                    <Badge variant="outline" className="ml-auto bg-[#008457]/10 text-[#008457] border-[#008457]/20 text-xs">
                      Active
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Great Southern Fuels © 2024
          </p>
        </div>
      </div>
    </div>
  );
}
