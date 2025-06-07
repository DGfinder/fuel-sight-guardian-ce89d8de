
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, TrendingUp, Clock } from "lucide-react";
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
      totalStock: 0,
      criticalTanks: 0,
      lowTanks: 0,
      averageDaysToEmpty: 0,
      averagePercent: 0
    };

    const criticalTanks = tanks.filter(tank => tank.current_level_percent <= 10).length;
    const lowTanks = tanks.filter(tank => tank.current_level_percent <= 20).length;
    const totalStock = tanks.reduce((sum, tank) => sum + tank.current_level, 0);
    const averagePercent = tanks.length > 0 ? Math.round(tanks.reduce((sum, tank) => sum + (tank.current_level_percent || 0), 0) / tanks.length) : 0;
    const tanksWithDays = tanks.filter(tank => tank.days_to_min_level !== null && tank.days_to_min_level > 0);
    const averageDaysToEmpty = tanksWithDays.length > 0 
      ? Math.round(tanksWithDays.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / tanksWithDays.length)
      : 0;

    return {
      totalStock,
      criticalTanks,
      lowTanks,
      averageDaysToEmpty,
      averagePercent
    };
  }, [tanks]);

  const cards = [
    {
      id: 'stock',
      title: 'Total Stock',
      value: `${kpis.totalStock.toLocaleString()} L`,
      subtitle: 'Total litres on hand',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'critical',
      title: 'Critical Tanks',
      value: kpis.criticalTanks.toString(),
      subtitle: 'Tanks below 10% capacity',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      alert: kpis.criticalTanks > 0
    },
    {
      id: 'low',
      title: 'Low Tanks',
      value: kpis.lowTanks.toString(),
      subtitle: 'Tanks below 20% capacity',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      alert: kpis.lowTanks > 0
    },
    {
      id: 'days',
      title: 'Avg Days to Empty',
      value: kpis.averageDaysToEmpty > 0 ? `${kpis.averageDaysToEmpty} days` : 'N/A',
      subtitle: 'Based on current consumption',
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;
        
        return (
          <Card
            key={card.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-md",
              "border-2",
              isSelected 
                ? "ring-2 ring-primary shadow-md" 
                : "hover:border-gray-300",
              card.alert && "ring-1 ring-red-200"
            )}
            onClick={() => onCardClick(card.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
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
                    <Badge variant="destructive" className="text-xs">
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
