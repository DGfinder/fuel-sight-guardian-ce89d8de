import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';

interface KPICardsProps {
  tanks: Tank[] | undefined;
  onCardClick: (filter: string) => void;
  selectedFilter: string | null;
}

export function KPICards({ tanks = [], onCardClick, selectedFilter }: KPICardsProps) {
  const kpis = useMemo(() => {
    if (!tanks) return {
      criticalTanks: 0,
      totalStock: 0,
      averagePercent: 0,
      averageDaysToEmpty: 0
    };

    const criticalTanks = tanks.filter(tank => tank.current_level_percent <= 20).length;
    const totalStock = tanks.reduce((sum, tank) => sum + tank.current_level, 0);
    const averagePercent = tanks.length > 0 ? Math.round(tanks.reduce((sum, tank) => sum + (tank.current_level_percent || 0), 0) / tanks.length) : 0;
    const averageDaysToEmpty = tanks.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / (tanks.length || 1);

    return {
      criticalTanks,
      totalStock,
      averagePercent,
      averageDaysToEmpty
    };
  }, [tanks]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50",
          selectedFilter === 'critical' && "ring-2 ring-primary"
        )}
        onClick={() => onCardClick('critical')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Tanks</CardTitle>
          <AlertTriangle className="h-4 w-4 text-fuel-critical" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.criticalTanks}</div>
          <p className="text-xs text-muted-foreground">
            Tanks below 20% capacity
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50",
          selectedFilter === 'stock' && "ring-2 ring-primary"
        )}
        onClick={() => onCardClick('stock')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
          <Droplets className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalStock.toLocaleString()} L</div>
          <p className="text-xs text-muted-foreground">
            Total litres across all tanks
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50",
          selectedFilter === 'avg' && "ring-2 ring-primary"
        )}
        onClick={() => onCardClick('avg')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Level</CardTitle>
          <TrendingUp className="h-4 w-4 text-fuel-safe" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.averagePercent}%</div>
          <p className="text-xs text-muted-foreground">
            Average % full across all tanks
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "cursor-pointer transition-colors hover:bg-gray-50",
          selectedFilter === 'days' && "ring-2 ring-primary"
        )}
        onClick={() => onCardClick('days')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Days to Empty</CardTitle>
          <TrendingUp className="h-4 w-4 text-fuel-safe" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.averageDaysToEmpty.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">
            Average days until empty
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
