import React from 'react';
import { useUserPermissions, useCanAccessSubgroup, useFilterTanksBySubgroup } from '@/hooks/useUserPermissions';
import { useTanks } from '@/hooks/useTanks';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SubgroupDebugPanel() {
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  const { tanks, isLoading: tanksLoading } = useTanks();
  const { filterTanks } = useFilterTanksBySubgroup();

  if (permissionsLoading || tanksLoading) return <div>Loading debug info...</div>;

  const gsfDepotGroup = permissions?.accessibleGroups.find(g => g.name === 'GSF Depots');
  const gsfTanks = (tanks || []).filter(t => t.group_name === 'GSF Depots');
  const filteredGsfTanks = filterTanks(gsfTanks);
  
  // Get unique subgroups in GSF Depots
  const allGsfSubgroups = [...new Set(gsfTanks.map(t => t.subgroup).filter(Boolean))];
  const filteredSubgroups = [...new Set(filteredGsfTanks.map(t => t.subgroup).filter(Boolean))];

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>🔍 Subgroup System Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">User Permissions</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Role:</strong> {permissions?.role || 'N/A'}
            </div>
            <div>
              <strong>Is Admin:</strong> {permissions?.isAdmin ? 'Yes' : 'No'}
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">GSF Depots Access</h3>
          <div className="space-y-2">
            <div>
              <strong>Has GSF Depots Access:</strong> {gsfDepotGroup ? 'Yes' : 'No'}
            </div>
            {gsfDepotGroup && (
              <div>
                <strong>Allowed Subgroups:</strong> 
                <div className="flex flex-wrap gap-1 mt-1">
                  {gsfDepotGroup.subgroups.length === 0 ? (
                    <Badge variant="outline">All Subgroups (No Restrictions)</Badge>
                  ) : (
                    gsfDepotGroup.subgroups.map(sub => (
                      <Badge key={sub} variant="secondary">{sub}</Badge>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Tank Filtering Results</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Total GSF Tanks:</strong> {gsfTanks.length}
              <div className="text-sm text-gray-600">
                Subgroups: {allGsfSubgroups.map(sub => sub).join(', ') || 'None'}
              </div>
            </div>
            <div>
              <strong>Filtered GSF Tanks:</strong> {filteredGsfTanks.length}
              <div className="text-sm text-gray-600">
                Accessible Subgroups: {filteredSubgroups.map(sub => sub).join(', ') || 'None'}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Individual Subgroup Tests</h3>
          <div className="grid grid-cols-3 gap-2">
            {allGsfSubgroups.map(subgroup => {
              const canAccess = permissions?.isAdmin || 
                              (gsfDepotGroup && (gsfDepotGroup.subgroups.length === 0 || gsfDepotGroup.subgroups.includes(subgroup)));
              return (
                <div key={subgroup} className="p-2 border rounded">
                  <div className="font-medium">{subgroup}</div>
                  <Badge variant={canAccess ? "default" : "destructive"}>
                    {canAccess ? "✅ Access" : "❌ Blocked"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <strong>Debug Info:</strong>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              userRole: permissions?.role,
              isAdmin: permissions?.isAdmin,
              gsfDepotGroupFound: !!gsfDepotGroup,
              gsfDepotSubgroups: gsfDepotGroup?.subgroups || [],
              totalGsfTanks: gsfTanks.length,
              filteredGsfTanks: filteredGsfTanks.length,
              allSubgroups: allGsfSubgroups,
              filteredSubgroups: filteredSubgroups
            }, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}