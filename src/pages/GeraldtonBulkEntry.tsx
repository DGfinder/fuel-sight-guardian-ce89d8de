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

const GERALDTON_GROUP_NAME = 'Geraldton';

export default function GeraldtonBulkEntryPage() {
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

  // Filter tanks for Geraldton group
  const filteredTanks = useMemo(() => {
    if (!tanks) return [];
    
    const geraldtonTanks = tanks.filter(t => 
      (t.group_name && t.group_name.trim().toLowerCase() === 'geraldton') ||
      (t.group_id && t.group_id === 'f241442c-4b74-49e4-8d4b-ea7a1392d91a')
    );
    
    return geraldtonTanks;
  }, [tanks]);

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
      <AppLayout selectedGroup={GERALDTON_GROUP_NAME} onGroupSelect={() => {}}>
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
    <AppLayout selectedGroup={GERALDTON_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/geraldton')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Geraldton Bulk Dip Entry</h1>
                  <p className="text-gray-600 mt-1">
                    Excel-style workflow: {totalTanks} tanks organized across {totalSubgroups} subgroups
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each subgroup below represents a section from your Excel sheet
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
                  Complete dip readings for each subgroup below. Each subgroup represents a section from your Excel workflow.
                  Progress is saved automatically as you go.
                  {completedSubgroups.size === totalSubgroups && (
                    <span className="text-green-600 font-medium ml-2">
                      All subgroups completed! 🎉
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Subgroup Overview */}
            {totalSubgroups > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalSubgroups}</div>
                  <div className="text-sm text-muted-foreground">Subgroups</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{totalTanks}</div>
                  <div className="text-sm text-muted-foreground">Total Tanks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedSubgroups.size}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{totalSubgroups - completedSubgroups.size}</div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
              </div>
            )}

            {/* Subgroup Entry Cards */}
            <div className="space-y-6">
              {Object.entries(tanksBySubgroup).map(([subgroup, subgroupTanks]) => {
                const isCompleted = completedSubgroups.has(subgroup);
                return (
                  <div 
                    key={subgroup} 
                    className={`transition-all duration-200 ${
                      isCompleted 
                        ? 'opacity-75 transform scale-[0.98] border-l-4 border-green-500' 
                        : 'border-l-4 border-blue-500'
                    }`}
                  >
                    <div className="relative">
                      {isCompleted && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
                            ✓
                          </div>
                        </div>
                      )}
                      <SubgroupQuickEntry
                        subgroup={subgroup}
                        tanks={subgroupTanks}
                        dipDate={dipDate}
                        userId={userId}
                        userProfile={userProfile}
                        onSuccess={() => handleSubgroupSuccess(subgroup)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {totalSubgroups === 0 && (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  No tanks found for bulk entry.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You may not have permission to access any Geraldton subgroups.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}