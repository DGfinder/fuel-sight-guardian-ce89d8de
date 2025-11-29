import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Fuel,
  LayoutDashboard,
  Map,
  Bell,
  Settings,
  Search,
  Activity,
  Database,
  Droplets,
  MapPin,
  Gauge,
} from 'lucide-react';
import { useTanks, Tank } from '@/hooks/useTanks';
import { useTankModal } from '@/contexts/TankModalContext';
import { useGlobalModals } from '@/contexts/GlobalModalsContext';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data: tanks = [] } = useTanks();
  const { openModal } = useTankModal();
  const { openAlerts } = useGlobalModals();
  const [search, setSearch] = useState('');

  const runCommand = useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  // Filter tanks based on search
  const filteredTanks = tanks.filter((tank: Tank) => {
    const searchLower = search.toLowerCase();
    return (
      tank.location?.toLowerCase().includes(searchLower) ||
      tank.group_name?.toLowerCase().includes(searchLower) ||
      tank.subgroup?.toLowerCase().includes(searchLower) ||
      tank.product_type?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 8); // Limit to 8 results

  // Navigation pages
  const pages = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, shortcut: 'D' },
    { name: 'Tanks', path: '/tanks', icon: Fuel, shortcut: 'T' },
    { name: 'Map View', path: '/map', icon: Map, shortcut: 'M' },
    { name: 'Alerts', path: '/alerts', icon: Bell, shortcut: 'A' },
    { name: 'Settings', path: '/settings', icon: Settings, shortcut: 'S' },
    { name: 'System Health', path: '/settings/health', icon: Activity },
    { name: 'AgBot', path: '/agbot', icon: Database },
    { name: 'SmartFill', path: '/smartfill', icon: Droplets },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tanks, pages, or actions..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Tank Search Results */}
        {search.length > 0 && filteredTanks.length > 0 && (
          <CommandGroup heading="Tanks">
            {filteredTanks.map((tank: Tank) => (
              <CommandItem
                key={tank.id}
                value={`tank-${tank.id}-${tank.location}`}
                onSelect={() => runCommand(() => openModal(tank))}
              >
                <Gauge className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{tank.location}</span>
                  <span className="text-xs text-muted-foreground">
                    {tank.group_name} {tank.subgroup && `• ${tank.subgroup}`} • {Math.round(tank.current_level_percent)}%
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {search.length > 0 && filteredTanks.length > 0 && <CommandSeparator />}

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="view-alerts"
            onSelect={() => runCommand(() => openAlerts())}
          >
            <Bell className="mr-2 h-4 w-4" />
            <span>View Active Alerts</span>
          </CommandItem>
          <CommandItem
            value="search-tanks"
            onSelect={() => runCommand(() => navigate('/tanks'))}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search All Tanks</span>
          </CommandItem>
          <CommandItem
            value="view-map"
            onSelect={() => runCommand(() => navigate('/map'))}
          >
            <MapPin className="mr-2 h-4 w-4" />
            <span>Open Map View</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {pages.map((page) => (
            <CommandItem
              key={page.path}
              value={`navigate-${page.name.toLowerCase()}`}
              onSelect={() => runCommand(() => navigate(page.path))}
            >
              <page.icon className="mr-2 h-4 w-4" />
              <span>{page.name}</span>
              {page.shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>{page.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Hook for managing command palette state
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
}
