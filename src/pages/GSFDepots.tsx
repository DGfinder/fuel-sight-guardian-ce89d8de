import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { useFilterTanksBySubgroup } from '@/hooks/useUserPermissions';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import EditDipModal from '@/components/modals/EditDipModal';
import { supabase } from '@/lib/supabase';
import SubgroupChartSection from '@/components/SubgroupChartSection';

const GSF_DEPOTS_GROUP_NAME = 'GSF Depots';

export default function GSFDepotsPage() {
  const { tanks, isLoading } = useTanks();
  const { filterTanks, permissions, isLoading: permissionsLoading } = useFilterTanksBySubgroup();
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [tankDetailsOpen, setTankDetailsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState(null);
  const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Filter tanks by GSF Depots group and apply subgroup permissions
  const groupFilteredTanks = (tanks || []).filter(t => t.group_name === GSF_DEPOTS_GROUP_NAME);

  // Only filter if permissions are loaded
  const gsfDepotsTanks = (!permissionsLoading && permissions) ? filterTanks(groupFilteredTanks) : (groupFilteredTanks || []);

  // Further filter by selected subgroup for the table view
  const displayedTanks = selectedSubgroup
    ? gsfDepotsTanks.filter(t => t.subgroup === selectedSubgroup)
    : gsfDepotsTanks;

  const selectedTank = gsfDepotsTanks.find(t => t.id === selectedTankId) || null;

  // Debug subgroup filtering with safe access
  console.log('🔍 [GSF DEPOTS DEBUG] Subgroup filtering:', {
    tanksLoading: isLoading,
    permissionsLoading,
    totalGSFTanks: groupFilteredTanks.length,
    filteredTanks: gsfDepotsTanks.length,
    userPermissions: permissions?.role,
    isAdmin: permissions?.isAdmin,
    hasAccessibleGroups: Array.isArray(permissions?.accessibleGroups),
    accessibleSubgroups: permissions?.accessibleGroups?.find(g => g?.name === GSF_DEPOTS_GROUP_NAME)?.subgroups
  });

  // Show filtering results prominently with safe access
  if (permissions && !permissionsLoading && !permissions.isAdmin && groupFilteredTanks.length !== gsfDepotsTanks.length) {
    console.log('🎯 [SUBGROUP FILTERING ACTIVE]', {
      original: groupFilteredTanks.length,
      filtered: gsfDepotsTanks.length,
      hidden: groupFilteredTanks.length - gsfDepotsTanks.length,
      allowedSubgroups: permissions.accessibleGroups?.find(g => g?.name === GSF_DEPOTS_GROUP_NAME)?.subgroups
    });
  }

  // Show loading state
  if (isLoading || permissionsLoading) {
    return (
      <AppLayout selectedGroup={GSF_DEPOTS_GROUP_NAME} onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-muted">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
            <div className="space-y-6 p-6">
              <div className="flex justify-center items-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">
                    Loading {isLoading ? 'tanks' : ''} {permissionsLoading ? 'permissions' : ''}...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout selectedGroup={GSF_DEPOTS_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">GSF Depots Dashboard</h1>
                <p className="text-gray-600 mt-1">
                  {selectedSubgroup
                    ? `Viewing ${displayedTanks.length} tanks in ${selectedSubgroup}`
                    : `Monitoring ${gsfDepotsTanks.length} tanks in GSF Depots`}
                </p>
              </div>
            </div>
            <KPICards tanks={displayedTanks} onCardClick={() => {}} selectedFilter={null} />

            {/* Tank Charts by Subgroup */}
            <SubgroupChartSection
              tanks={gsfDepotsTanks}
              onSubgroupChange={setSelectedSubgroup}
            />

            <div className="flex items-center justify-between mb-4 mt-8">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedSubgroup ? `${selectedSubgroup} - Tank Status` : 'Tank Status'}
              </h2>
            </div>
            <TankStatusTable
              tanks={displayedTanks}
              onTankClick={tank => {
                setSelectedTankId(tank.id);
                setTankDetailsOpen(true);
              }}
              setEditDipTank={setEditDipTank}
              setEditDipModalOpen={setEditDipModalOpen}
            />

            <TankDetailsModal
              tank={selectedTank}
              open={tankDetailsOpen}
              onOpenChange={setTankDetailsOpen}
            />
            
            <EditDipModal
              isOpen={editDipModalOpen}
              onClose={() => setEditDipModalOpen(false)}
              initialTankId={editDipTank?.id}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 