import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, Clock, Gauge, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerContainerVariants, fadeInItemVariants } from "@/lib/motion-variants";
import type { Tank } from '@/types/fuel';

interface KPICardsProps {
  tanks: Tank[] | undefined;
  onCardClick: (filter: string) => void;
  selectedFilter: string | null;
}

function calculateTotalUllage(tanks: Tank[]): number {
  return tanks.reduce((sum, tank) => {
    if (
      typeof tank.safe_level === 'number' &&
      typeof tank.current_level === 'number'
    ) {
      return sum + (tank.safe_level - tank.current_level);
    }
    return sum;
  }, 0);
}

export function KPICards({ tanks = [], onCardClick, selectedFilter }: KPICardsProps) {
  
  const kpis = useMemo(() => {
    if (!tanks?.length) {
      return {
        lowTanks: 0,
        criticalDays: 0,
        totalStock: 0,
        totalUllage: 0,
        avgDaysToMin: 0
      };
    }

    // Only consider tanks with a dip and valid data
    const tanksWithDip = tanks.filter(tank => {
      const hasLastDip = !!tank.last_dip?.created_at;
      const hasCurrentLevel = tank.current_level != null;
      const hasSafeLevel = tank.safe_level != null && tank.safe_level > 0;
      return hasLastDip && hasCurrentLevel && hasSafeLevel;
    });
    

    // 🔴 Tanks < 20% Capacity (with dip) - Use pre-calculated percentage from SQL
    const lowTanks = tanksWithDip.filter(tank => {
      const percentFromSQL = tank.current_level_percent || 0;
      return percentFromSQL <= 20;
    }).length;

    // 🟡 Tanks ≤ 2 Days to Min (with dip)
    const criticalDays = tanksWithDip.filter(tank => {
      const isLowDays = tank.days_to_min_level !== null && tank.days_to_min_level !== undefined && tank.days_to_min_level <= 2;
      return isLowDays;
    }).length;

    // 💧 Total Fuel on Hand (sum of current_level, with dip)
    const totalStock = tanksWithDip.reduce((sum, tank) => sum + (tank.current_level || 0), 0);

    // ⛽ Total Ullage (safe_level - current_level, with dip)
    const totalUllage = calculateTotalUllage(tanksWithDip);

    // ⏳ Average Days-to-Min (with dip)
    const tanksWithDays = tanksWithDip.filter(tank => 
      tank.days_to_min_level !== null && tank.days_to_min_level !== undefined && tank.days_to_min_level > 0
    );
    const avgDaysToMin = tanksWithDays.length > 0 
      ? Math.round(tanksWithDays.reduce((sum, tank) => sum + (tank.days_to_min_level || 0), 0) / tanksWithDays.length)
      : 0;

    const result = {
      lowTanks,
      criticalDays,
      totalStock,
      totalUllage,
      avgDaysToMin
    };
    
    return result;
  }, [tanks]);

  const cards = [
    {
      id: 'low-tanks',
      title: 'Tanks < 20%',
      value: kpis.lowTanks.toString(),
      subtitle: 'Low fuel level',
      icon: AlertTriangle,
      color: kpis.lowTanks === 0 ? 'text-success' : 'text-error',
      bgColor: kpis.lowTanks === 0 ? 'bg-success/10' : 'bg-error/10',
      borderColor: kpis.lowTanks === 0 ? 'border-success/20' : 'border-error/20',
      alert: kpis.lowTanks > 0,
      emoji: '🔴'
    },
    {
      id: 'critical-days',
      title: 'Tanks ≤ 2 Days to Min',
      value: kpis.criticalDays.toString(),
      subtitle: 'Critical timeline',
      icon: Clock,
      color: kpis.criticalDays === 0 ? 'text-success' : 'text-warning',
      bgColor: kpis.criticalDays === 0 ? 'bg-success/10' : 'bg-warning/10',
      borderColor: kpis.criticalDays === 0 ? 'border-success/20' : 'border-warning/20',
      alert: kpis.criticalDays > 0,
      emoji: '🟡'
    },
    {
      id: 'total-stock',
      title: 'Total Fuel on Hand',
      value: `${(kpis.totalStock / 1000).toFixed(0)}K L`,
      subtitle: 'Current inventory',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      emoji: '💧'
    },
    {
      id: 'total-ullage',
      title: 'Total Ullage',
      value: isNaN(kpis.totalUllage) ? 'N/A' : `${Math.round(kpis.totalUllage / 1000)}K L`,
      subtitle: 'Available capacity',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      emoji: '⛽'
    },
    {
      id: 'avg-days',
      title: 'Avg Days-to-Min',
      value: kpis.avgDaysToMin > 0 ? `${kpis.avgDaysToMin}` : 'N/A',
      subtitle: 'Fleet average',
      icon: Gauge,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
      emoji: '⏳'
    }
  ];

  return (
    <motion.div
      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:gap-4 md:grid-cols-5 md:overflow-visible md:pb-0"
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;

        return (
          <motion.div
            key={card.id}
            variants={fadeInItemVariants}
            className="snap-start flex-shrink-0 w-[200px] md:w-auto"
          >
            <Card
              animated
              className={cn(
                "cursor-pointer border-2 h-full",
                isSelected
                  ? "ring-2 ring-primary shadow-lg border-primary/50 bg-primary/5"
                  : "hover:border-primary/30 border-gray-200",
                card.alert && "ring-1 ring-red-200 shadow-md"
              )}
              onClick={() => onCardClick(card.id)}
            >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{card.emoji}</span>
                  <span className="font-semibold">{card.title}</span>
                </div>
              </CardTitle>
              <div className={cn("p-2 rounded-lg border", card.bgColor, card.borderColor)}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  {card.alert && (
                    <Badge variant="destructive" className="text-xs animate-pulse bg-red-100 text-red-800 border-red-200">
                      Alert
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  {card.subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        );
      })}
    </motion.div>
  );
}
