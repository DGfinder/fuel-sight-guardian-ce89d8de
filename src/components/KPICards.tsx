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

function formatVolume(liters: number): string {
  if (liters >= 1_000_000) {
    return `${(liters / 1_000_000).toFixed(1)}M L`;
  }
  if (liters >= 1_000) {
    return `${(liters / 1_000).toFixed(1)}K L`;
  }
  return `${Math.round(liters)} L`;
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
      bgGradient: kpis.lowTanks === 0 ? 'from-green-100 to-green-50' : 'from-red-100 to-red-50',
      alert: kpis.lowTanks > 0
    },
    {
      id: 'critical-days',
      title: 'Tanks ≤ 2 Days',
      value: kpis.criticalDays.toString(),
      subtitle: 'Critical timeline',
      icon: Clock,
      color: kpis.criticalDays === 0 ? 'text-success' : 'text-warning',
      bgGradient: kpis.criticalDays === 0 ? 'from-green-100 to-green-50' : 'from-amber-100 to-amber-50',
      alert: kpis.criticalDays > 0
    },
    {
      id: 'total-stock',
      title: 'Fuel on Hand',
      value: formatVolume(kpis.totalStock),
      subtitle: 'Current inventory',
      icon: Droplets,
      color: 'text-blue-600',
      bgGradient: 'from-blue-100 to-blue-50',
      alert: false
    },
    {
      id: 'total-ullage',
      title: 'Total Ullage',
      value: isNaN(kpis.totalUllage) ? 'N/A' : formatVolume(kpis.totalUllage),
      subtitle: 'Available capacity',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgGradient: 'from-purple-100 to-purple-50',
      alert: false
    },
    {
      id: 'avg-days',
      title: 'Avg Days-to-Min',
      value: kpis.avgDaysToMin > 0 ? `${kpis.avgDaysToMin}` : 'N/A',
      subtitle: 'Fleet average',
      icon: Gauge,
      color: 'text-success',
      bgGradient: 'from-green-100 to-green-50',
      alert: false
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
                "cursor-pointer h-full transition-all duration-300",
                "backdrop-blur-md bg-white/70 border border-white/30",
                "shadow-lg hover:shadow-xl hover:-translate-y-1",
                "rounded-xl overflow-hidden",
                isSelected
                  ? "ring-2 ring-primary shadow-xl border-primary/50"
                  : "",
                card.alert && "ring-2 ring-red-300/50 shadow-red-100/50"
              )}
              onClick={() => onCardClick(card.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {card.title}
                </CardTitle>
                <div className={cn(
                  "p-2 rounded-xl",
                  "bg-gradient-to-br",
                  card.bgGradient
                )}>
                  <Icon className={cn("h-4 w-4", card.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-gray-900">{card.value}</div>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                {card.alert && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-xs font-medium text-red-600">Requires attention</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
