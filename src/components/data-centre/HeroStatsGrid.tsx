import React, { useEffect, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Shield,
  CreditCard,
  Users,
  Navigation,
  TrendingUp,
  AlertTriangle,
  Activity,
  Database
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  suffix?: string;
}

interface StatCardPropsInternal extends StatCardProps {
  delay?: number;
}

const StatCard: React.FC<StatCardPropsInternal> = ({
  icon: Icon,
  value,
  label,
  suffix = '',
  delay = 0
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));

  useEffect(() => {
    const visibilityTimer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(visibilityTimer);
  }, [delay]);

  useEffect(() => {
    if (typeof value === 'number' && value > 0 && isVisible) {
      const duration = 1500; // 1.5 seconds
      const steps = 60;
      const stepValue = value / steps;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep <= steps) {
          setDisplayValue(Math.floor(stepValue * currentStep));
        } else {
          setDisplayValue(value);
          clearInterval(timer);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    } else if (isVisible) {
      setDisplayValue(numericValue);
    }
  }, [value, numericValue, isVisible]);

  const formatValue = (val: number): string => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toLocaleString();
  };

  return (
    <div
      className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <GlassCard variant="elevated" gradient="none" hover className="group border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-baseline gap-1 mb-1">
              <h3 className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                {typeof value === 'number' ? formatValue(displayValue) : value}
                {suffix && <span className="text-lg ml-1 text-slate-600 dark:text-slate-400">{suffix}</span>}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {label}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
            <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        {/* Professional update indicator */}
        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <span className="text-xs text-slate-500 dark:text-slate-500">Real-time data</span>
        </div>
      </GlassCard>
    </div>
  );
};

interface HeroStatsGridProps {
  stats: {
    guardianEvents?: number;
    paymentRecords?: number;
    activeDrivers?: number;
    totalTrips?: number;
    safetyScore?: number;
    totalVehicles?: number;
    correlationRate?: number;
    dataQuality?: number;
  };
}

export const HeroStatsGrid: React.FC<HeroStatsGridProps> = ({ stats }) => {
  const {
    guardianEvents = 0,
    paymentRecords = 0,
    activeDrivers = 0,
    totalTrips = 0,
    safetyScore = 0,
    totalVehicles = 0,
    correlationRate = 0,
    dataQuality = 0,
  } = stats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Shield}
        value={guardianEvents}
        label="Guardian Events"
        delay={0}
      />
      <StatCard
        icon={CreditCard}
        value={paymentRecords}
        label="Payment Records"
        delay={75}
      />
      <StatCard
        icon={Users}
        value={activeDrivers}
        label="Active Drivers"
        delay={150}
      />
      <StatCard
        icon={Navigation}
        value={totalTrips}
        label="Total Trips"
        delay={225}
      />
      <StatCard
        icon={TrendingUp}
        value={safetyScore}
        label="Avg Safety Score"
        suffix="/10"
        delay={300}
      />
      <StatCard
        icon={AlertTriangle}
        value={totalVehicles}
        label="Fleet Vehicles"
        delay={375}
      />
      <StatCard
        icon={Activity}
        value={correlationRate}
        label="Correlation Rate"
        suffix="%"
        delay={450}
      />
      <StatCard
        icon={Database}
        value={dataQuality}
        label="Data Quality"
        suffix="%"
        delay={525}
      />
    </div>
  );
};
