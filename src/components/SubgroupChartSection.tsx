import React, { useState } from 'react';
import { Tank } from '@/types/fuel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TankBarChart from '@/components/charts/TankBarChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SubgroupChartSectionProps {
  tanks: Tank[];
  onSubgroupChange?: (subgroup: string | null) => void;
}

interface SubgroupData {
  name: string;
  tanks: Tank[];
  lowFuelCount: number;
  criticalCount: number;
  avgFuelLevel: number;
}

export default function SubgroupChartSection({ tanks, onSubgroupChange }: SubgroupChartSectionProps) {
  const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(null);
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

  // Auto-select the first subgroup on initial load
  React.useEffect(() => {
    if (subgroupData.length > 0 && selectedSubgroup === null) {
      console.log('[SubgroupChartSection] Auto-selecting first subgroup:', subgroupData[0].name);
      setSelectedSubgroup(subgroupData[0].name);
      if (onSubgroupChange) {
        onSubgroupChange(subgroupData[0].name);
      }
    }
  }, [subgroupData, selectedSubgroup, onSubgroupChange]);

  const handleSubgroupChange = (value: string) => {
    setSelectedSubgroup(value);
    if (onSubgroupChange) {
      onSubgroupChange(value);
    }
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
    selectedSubgroup,
    showCharts
  });

  // Get the currently selected subgroup data
  const currentSubgroup = subgroupData.find(sg => sg.name === selectedSubgroup);

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
      {/* Section Header with Depot Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Tank Fuel Levels by Location</h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedSubgroup || undefined} onValueChange={handleSubgroupChange}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select depot..." />
            </SelectTrigger>
            <SelectContent>
              {subgroupData.map(sg => (
                <SelectItem key={sg.name} value={sg.name}>
                  {sg.name} ({sg.tanks.length} tanks)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCharts(!showCharts)}
            className="text-sm"
          >
            {showCharts ? 'Hide Chart' : 'Show Chart'}
          </Button>
        </div>
      </div>

      {/* Selected Subgroup Chart */}
      {showCharts && currentSubgroup && (
        <Card
          className={`bg-white border-l-4 ${getHealthColor(currentSubgroup)} shadow-sm`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{currentSubgroup.name}</CardTitle>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span>{currentSubgroup.tanks.length} tanks</span>
                  <span>•</span>
                  <span>Avg: {currentSubgroup.avgFuelLevel}%</span>
                  {currentSubgroup.lowFuelCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-yellow-600">{currentSubgroup.lowFuelCount} low fuel</span>
                    </>
                  )}
                  {currentSubgroup.criticalCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-600">{currentSubgroup.criticalCount} critical</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentSubgroup.criticalCount > 0 && (
                  <Badge variant="destructive" className="bg-red-600">
                    {currentSubgroup.criticalCount} Critical
                  </Badge>
                )}
                {currentSubgroup.lowFuelCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    {currentSubgroup.lowFuelCount} Low
                  </Badge>
                )}
                {currentSubgroup.criticalCount === 0 && currentSubgroup.lowFuelCount === 0 && (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                    All Good
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="border-t pt-4">
              <TankBarChart
                tanks={currentSubgroup.tanks}
                subgroupName={currentSubgroup.name}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
