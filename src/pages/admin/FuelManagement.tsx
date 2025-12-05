/**
 * FuelManagement Admin Page
 * Main admin page for managing Tank Groups, Fuel Tanks, and Dip Readings
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  Layers,
  Fuel,
  ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Tab components
import TankGroupsTab from '@/components/admin/TankGroupsTab';
import FuelTanksTab from '@/components/admin/FuelTanksTab';
import DipHistoryTab from '@/components/admin/DipHistoryTab';

type TabValue = 'groups' | 'tanks' | 'dips';

export default function FuelManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabValue) || 'groups';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // Fetch entity counts for badges
  const { data: counts } = useQuery({
    queryKey: ['admin-entity-counts'],
    queryFn: async () => {
      const [groupsResult, tanksResult, dipsResult] = await Promise.all([
        supabase.from('tank_groups').select('*', { count: 'exact', head: true }),
        supabase.from('fuel_tanks').select('*', { count: 'exact', head: true }),
        supabase.from('ta_tank_dips').select('*', { count: 'exact', head: true }).is('archived_at', null),
      ]);

      return {
        groups: groupsResult.count || 0,
        tanks: tanksResult.count || 0,
        dips: dipsResult.count || 0,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Fuel Management Admin
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage tank groups, fuel tanks, and dip history
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Tank Groups"
          value={counts?.groups ?? 0}
          icon={Layers}
          color="blue"
          active={activeTab === 'groups'}
          onClick={() => handleTabChange('groups')}
        />
        <StatCard
          label="Fuel Tanks"
          value={counts?.tanks ?? 0}
          icon={Fuel}
          color="green"
          active={activeTab === 'tanks'}
          onClick={() => handleTabChange('tanks')}
        />
        <StatCard
          label="Dip Readings"
          value={counts?.dips ?? 0}
          icon={ClipboardList}
          color="purple"
          active={activeTab === 'dips'}
          onClick={() => handleTabChange('dips')}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="groups" className="gap-2">
            <Layers className="h-4 w-4" />
            Groups
            {counts?.groups !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {counts.groups}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tanks" className="gap-2">
            <Fuel className="h-4 w-4" />
            Tanks
            {counts?.tanks !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {counts.tanks}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dips" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Dips
            {counts?.dips !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {counts.dips}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="mt-4">
          <TankGroupsTab />
        </TabsContent>

        <TabsContent value="tanks" className="mt-4">
          <FuelTanksTab />
        </TabsContent>

        <TabsContent value="dips" className="mt-4">
          <DipHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple';
  active?: boolean;
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };

  const borderClasses = {
    blue: 'border-blue-500',
    green: 'border-green-500',
    purple: 'border-purple-500',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        active && `border-2 ${borderClasses[color]}`
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
