
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, Clock, Gauge, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';

interface KPICardsProps {
  tanks: Tank[] | undefined;
  onCardClick: (filter: string) => void;
  selectedFilter: string | null;
}

export function KPICards({ tanks = [], onCardClick, selectedFilter }: KPICardsProps) {
  const kpis = useMemo(() => {
    if (!tanks?.length) return {
      criticalDays: 0,
      lowTanks: 0,
      totalStock: 0,
      totalUllage: 0,
      avgDaysToMin: 0
    };

    // 🔴 Tanks with ≤ 2 Days to Run (Critical)
    const criticalDays = tanks.filter(tank => 
      tank.days_to_min_level !== null && tank.days_to_min_level <= 2
    ).length;

    // 🟡 Tanks < 20% Capacity (Low)
    const lowTanks = tanks.filter(tank => tank.current_level_percent <= 20).length;

    // 💧 Total Stock (sum of current_level)
    const totalStock = tanks.reduce((sum, tank) => sum + tank.current_level, 0);

    // ⛽ Total Ullage (safe_fill - current_level)
    const totalUllage = tanks.reduce((sum, tank) => {
      return sum + Math.max(0, tank.safe_level - tank.current_level);
    }, 0);

    // ⏳ Average Days-to-Min
    const tanksWithDays = tanks.filter(tank => 
      tank.days_to_min_level !== null && tank.days_to_min_level > 0
    );
    const avgDaysToMin = tanksWithDays.length > 0 
      ? Math.round(tanksWithDays.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / tanksWithDays.length)
      : 0;

    return {
      criticalDays,
      lowTanks,
      totalStock,
      totalUllage,
      avgDaysToMin
    };
  }, [tanks]);

  const cards = [
    {
      id: 'critical-days',
      title: 'Critical Tanks',
      value: kpis.criticalDays.toString(),
      subtitle: '≤ 2 days to run out',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      alert: kpis.criticalDays > 0,
      badge: '🔴'
    },
    {
      id: 'low-tanks',
      title: 'Low Tanks',
      value: kpis.lowTanks.toString(),
      subtitle: '< 20% capacity',
      icon: Gauge,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      alert: kpis.lowTanks > 0,
      badge: '🟡'
    },
    {
      id: 'total-stock',
      title: 'Total Stock',
      value: `${kpis.totalStock.toLocaleString()} L`,
      subtitle: 'Fuel on hand',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badge: '💧'
    },
    {
      id: 'total-ullage',
      title: 'Total Ullage',
      value: `${kpis.totalUllage.toLocaleString()} L`,
      subtitle: 'Capacity available',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      badge: '⛽'
    },
    {
      id: 'avg-days',
      title: 'Avg Days to Min',
      value: kpis.avgDaysToMin > 0 ? `${kpis.avgDaysToMin} days` : 'N/A',
      subtitle: 'Based on consumption',
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badge: '⏳'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;
        
        return (
          <Card
            key={card.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
              "border-2",
              isSelected 
                ? "ring-2 ring-green-500 shadow-lg border-green-300" 
                : "hover:border-gray-300",
              card.alert && "ring-1 ring-red-200 shadow-md"
            )}
            onClick={() => onCardClick(card.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{card.badge}</span>
                  {card.title}
                </div>
              </CardTitle>
              <div className={cn("p-2 rounded-lg", card.bgColor, card.borderColor, "border")}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{card.value}</div>
                  {card.alert && (
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      Alert
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
