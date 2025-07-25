import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTanks } from '@/hooks/useTanks';
import { useTankGroups } from '@/hooks/useTankGroups';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/lib/supabase';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SubgroupQuickEntry from '@/components/SubgroupQuickEntry';
import type { Tank } from '@/types/fuel';

const KALGOORLIE_GROUP_NAME = 'Kalgoorlie';

export default function KalgoorlieBulkEntryPage() {
  const navigate = useNavigate();
  const { tanks, isLoading: tanksLoading } = useTanks();
  const { data: groups } = useTankGroups();
  const { data: permissions } = useUserPermissions();
  
  const [dipDate, setDipDate] = useState(new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [completedSubgroups, setCompletedSubgroups] = useState<Set<string>>(new Set());

  // Get user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
      }
    };
    fetchUserInfo();
  }, []);

  // Filter tanks for Kalgoorlie group and user permissions
  const filteredTanks = useMemo(() => {
    if (!tanks) return [];
    
    let kalgoorlieTanks = tanks.filter(t => t.group_name === KALGOORLIE_GROUP_NAME);
    
    // If user has subgroup restrictions, filter by those
    const groupPermission = permissions?.accessibleGroups.find(g => g.name === KALGOORLIE_GROUP_NAME);
    if (groupPermission && groupPermission.subgroups.length > 0) {
      kalgoorlieTanks = kalgoorlieTanks.filter(t => 
        t.subgroup && groupPermission.subgroups.includes(t.subgroup)
      );
    }
    
    return kalgoorlieTanks;
  }, [tanks, permissions]);

  // Group tanks by subgroup
  const tanksBySubgroup = useMemo(() => {
    const grouped: Record<string, Tank[]> = {};
    filteredTanks.forEach(tank => {
      const subgroup = tank.subgroup || 'No Subgroup';
      if (!grouped[subgroup]) grouped[subgroup] = [];
      grouped[subgroup].push(tank);
    });
    
    // Sort subgroups alphabetically
    const sorted: Record<string, Tank[]> = {};
    Object.keys(grouped)
      .sort()
      .forEach(key => {
        sorted[key] = grouped[key].sort((a, b) => 
          (a.location || '').localeCompare(b.location || '')
        );
      });
    
    return sorted;
  }, [filteredTanks]);

  const handleSubgroupSuccess = (subgroup: string) => {
    setCompletedSubgroups(prev => new Set(prev).add(subgroup));
  };

  const resetAll = () => {
    setCompletedSubgroups(new Set());
    // Force refresh of components by updating dipDate
    setDipDate(new Date(dipDate));
  };

  const totalSubgroups = Object.keys(tanksBySubgroup).length;
  const totalTanks = filteredTanks.length;

  if (tanksLoading) {
    return (
      <AppLayout selectedGroup={KALGOORLIE_GROUP_NAME} onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-muted flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading tank data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout selectedGroup={KALGOORLIE_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/kalgoorlie')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Bulk Dip Entry</h1>
                  <p className="text-gray-600 mt-1">
                    Quick entry for {totalTanks} tanks across {totalSubgroups} subgroups
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    {completedSubgroups.size} of {totalSubgroups} completed
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  disabled={completedSubgroups.size === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset All
                </Button>
              </div>
            </div>

            {/* Date Selection */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Date for all readings:</span>
              </div>
              <Input
                type="date"
                value={dipDate.toISOString().slice(0, 10)}
                onChange={(e) => setDipDate(new Date(e.target.value))}
                max={new Date().toISOString().slice(0, 10)}
                className="w-48"
              />
              <div className="text-sm text-muted-foreground">
                {format(dipDate, 'EEEE, MMMM do, yyyy')}
              </div>
            </div>

            {/* Progress Overview */}
            {totalSubgroups > 0 && (
              <Alert>
                <AlertDescription>
                  Complete dip readings for each subgroup below. Progress is saved automatically as you go.
                  {completedSubgroups.size === totalSubgroups && (
                    <span className="text-green-600 font-medium ml-2">
                      All subgroups completed! 🎉
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Subgroup Entry Cards */}
            <div className="space-y-6">
              {Object.entries(tanksBySubgroup).map(([subgroup, subgroupTanks]) => (
                <div key={subgroup} className={completedSubgroups.has(subgroup) ? 'opacity-75' : ''}>
                  <SubgroupQuickEntry
                    subgroup={subgroup}
                    tanks={subgroupTanks}
                    dipDate={dipDate}
                    userId={userId}
                    userProfile={userProfile}
                    onSuccess={() => handleSubgroupSuccess(subgroup)}
                  />
                </div>
              ))}
            </div>

            {/* Empty State */}
            {totalSubgroups === 0 && (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No tanks found for bulk entry.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You may not have permission to access any Kalgoorlie subgroups.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}