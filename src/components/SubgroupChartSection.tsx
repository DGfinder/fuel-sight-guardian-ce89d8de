import React, { useState } from 'react';
import { Tank } from '@/types/fuel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TankBarChart from '@/components/charts/TankBarChart';

interface SubgroupChartSectionProps {
  tanks: Tank[];
}

interface SubgroupData {
  name: string;
  tanks: Tank[];
  lowFuelCount: number;
  criticalCount: number;
  avgFuelLevel: number;
}

export default function SubgroupChartSection({ tanks }: SubgroupChartSectionProps) {
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [showCharts, setShowCharts] = useState(true);

  // Group tanks by subgroup
  const subgroupData: SubgroupData[] = React.useMemo(() => {
    console.log('[SubgroupChartSection] Processing tanks:', {
      totalTanks: tanks.length,
      sampleTank: tanks[0],
      tanksWithSubgroup: tanks.filter(t => t.subgroup).length
    });
    const grouped = tanks.reduce((acc, tank) => {
      const subgroup = tank.subgroup || 'Uncategorized';

      if (!acc[subgroup]) {
        acc[subgroup] = [];
      }

      acc[subgroup].push(tank);
      return acc;
    }, {} as Record<string, Tank[]>);

    // Calculate metrics for each subgroup
    return Object.entries(grouped).map(([name, subgroupTanks]) => {
      const tanksWithLevels = subgroupTanks.filter(t =>
        t.current_level_percent !== null && t.current_level_percent !== undefined
      );

      const lowFuelCount = tanksWithLevels.filter(t =>
        t.current_level_percent! < 20 && t.current_level_percent! > 0
      ).length;

      const criticalCount = tanksWithLevels.filter(t =>
        t.current_level_percent === 0
      ).length;

      const avgFuelLevel = tanksWithLevels.length > 0
        ? tanksWithLevels.reduce((sum, t) => sum + (t.current_level_percent || 0), 0) / tanksWithLevels.length
        : 0;

      return {
        name,
        tanks: subgroupTanks,
        lowFuelCount,
        criticalCount,
        avgFuelLevel: Math.round(avgFuelLevel)
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [tanks]);

  // Auto-expand the first subgroup on initial load
  React.useEffect(() => {
    if (subgroupData.length > 0 && expandedSubgroups.size === 0) {
      console.log('[SubgroupChartSection] Auto-expanding first subgroup:', subgroupData[0].name);
      setExpandedSubgroups(new Set([subgroupData[0].name]));
    }
  }, [subgroupData, expandedSubgroups.size]);

  const toggleSubgroup = (subgroupName: string) => {
    const newExpanded = new Set(expandedSubgroups);

    if (newExpanded.has(subgroupName)) {
      newExpanded.delete(subgroupName);
    } else {
      newExpanded.add(subgroupName);
    }

    setExpandedSubgroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedSubgroups(new Set(subgroupData.map(sg => sg.name)));
  };

  const collapseAll = () => {
    setExpandedSubgroups(new Set());
  };

  if (subgroupData.length === 0) {
    console.log('[SubgroupChartSection] No subgroup data - tanks missing subgroup field?');
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-yellow-900">Tank Charts Not Available</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Tanks need to have a <code className="bg-yellow-100 px-1 rounded">subgroup</code> field configured to display charts.
              {tanks.length > 0 && ` Found ${tanks.length} tanks without subgroup data.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log('[SubgroupChartSection] Rendering charts for subgroups:', {
    subgroupCount: subgroupData.length,
    subgroupNames: subgroupData.map(sg => sg.name),
    expandedCount: expandedSubgroups.size,
    showCharts
  });

  // Determine health border color based on fuel levels
  const getHealthColor = (subgroup: SubgroupData): string => {
    if (subgroup.criticalCount > 0) {
      return 'border-red-600';
    }
    if (subgroup.lowFuelCount > 0) {
      return 'border-yellow-500';
    }
    return 'border-green-600';
  };

  return (
    <div className="space-y-4">
      {/* Section Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Tank Fuel Levels by Location</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCharts(!showCharts)}
            className="text-sm"
          >
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </Button>

          {showCharts && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                disabled={expandedSubgroups.size === subgroupData.length}
              >
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                disabled={expandedSubgroups.size === 0}
              >
                Collapse All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Subgroup Charts */}
      {showCharts && subgroupData.map(subgroup => {
        const isExpanded = expandedSubgroups.has(subgroup.name);
        const healthColor = getHealthColor(subgroup);

        return (
          <Card
            key={subgroup.name}
            className={`bg-white border-l-4 ${healthColor} shadow-sm hover:shadow-md transition-all`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleSubgroup(subgroup.name)}
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}

                  <div className="flex-1">
                    <CardTitle className="text-lg">{subgroup.name}</CardTitle>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span>{subgroup.tanks.length} tanks</span>
                      <span>•</span>
                      <span>Avg: {subgroup.avgFuelLevel}%</span>
                      {subgroup.lowFuelCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-600">{subgroup.lowFuelCount} low fuel</span>
                        </>
                      )}
                      {subgroup.criticalCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{subgroup.criticalCount} critical</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {subgroup.criticalCount > 0 && (
                    <Badge variant="destructive" className="bg-red-600">
                      {subgroup.criticalCount} Critical
                    </Badge>
                  )}
                  {subgroup.lowFuelCount > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      {subgroup.lowFuelCount} Low
                    </Badge>
                  )}
                  {subgroup.criticalCount === 0 && subgroup.lowFuelCount === 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                      All Good
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="border-t pt-4">
                  <TankBarChart
                    tanks={subgroup.tanks}
                    subgroupName={subgroup.name}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
