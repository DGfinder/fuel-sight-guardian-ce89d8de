import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefillCalendar } from '@/components/calendar/RefillCalendar';
import { RefillTimelineStrip } from '@/components/calendar/RefillTimelineStrip';
import { useCustomerRefillCalendar } from '@/hooks/useRefillCalendar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { calculateUrgencySummary, sortByUrgency, RefillPrediction } from '@/lib/urgency-calculator';
import { AlertTriangle, Clock, CheckCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';
import { CalendarWeatherOverlay } from '@/components/ui/CalendarWeatherOverlay';
import { useCustomerTanks } from '@/hooks/useCustomerAuth';

export default function CustomerCalendar() {
  const navigate = useNavigate();
  const { data: predictions, isLoading } = useCustomerRefillCalendar();
  const { data: tanks } = useCustomerTanks();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  const sortedPredictions = sortByUrgency(predictions || []);
  const summary = calculateUrgencySummary(predictions || []);

  const handleTankClick = (tank: RefillPrediction) => {
    navigate(`/customer/tanks/${tank.tankId}`);
  };

  const handleTimelineTankClick = (tankId: string) => {
    navigate(`/customer/tanks/${tankId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Refill Calendar
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Predicted refill dates based on consumption patterns
        </p>
      </div>

      {/* Summary Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeUpItemVariants}>
          <KPICard
            title="Critical"
            value={summary.critical}
            subtitle="< 3 days"
            icon={AlertTriangle}
            color="red"
            trend={summary.critical > 0 ? 'down' : 'neutral'}
            trendValue={summary.critical > 0 ? 'Needs immediate refill' : 'None critical'}
            alert={summary.critical > 0}
          />
        </motion.div>
        <motion.div variants={fadeUpItemVariants}>
          <KPICard
            title="Warning"
            value={summary.warning}
            subtitle="3-7 days"
            icon={Clock}
            color="yellow"
            trend={summary.warning > 0 ? 'down' : 'neutral'}
            trendValue={summary.warning > 0 ? 'Order soon' : 'No warnings'}
            alert={summary.warning > 0}
          />
        </motion.div>
        <motion.div variants={fadeUpItemVariants}>
          <KPICard
            title="Normal"
            value={summary.normal}
            subtitle="7+ days"
            icon={CheckCircle}
            color="green"
            trend="neutral"
            trendValue="Adequate supply"
          />
        </motion.div>
        <motion.div variants={fadeUpItemVariants}>
          <KPICard
            title="Unknown"
            value={summary.unknown}
            subtitle="No data"
            icon={HelpCircle}
            color="gray"
            trend="neutral"
            trendValue="Insufficient data"
          />
        </motion.div>
      </motion.div>

      {/* Timeline Strip - Primary View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <RefillTimelineStrip
          predictions={predictions || []}
          maxDays={30}
          onTankClick={handleTimelineTankClick}
        />
      </motion.div>

      {/* Secondary Content - Calendar + List */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar - now smaller, on the left */}
        <div>
          <RefillCalendar
            predictions={predictions || []}
            onTankClick={handleTankClick}
            showCustomerName={false}
          />
        </div>

        {/* Upcoming Refills List - on the right */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Upcoming Refills</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedPredictions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No refill predictions available
                </p>
              ) : (
                <div className="space-y-3">
                  {sortedPredictions.slice(0, 10).map((tank) => (
                    <UpcomingRefillRow
                      key={tank.tankId}
                      tank={tank}
                      onClick={() => handleTankClick(tank)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weather Overlay for upcoming refills */}
          {(() => {
            // Get first tank with coordinates for weather
            const tankWithCoords = tanks?.find(t => t.lat && t.lng);
            if (!tankWithCoords || sortedPredictions.length === 0) return null;

            const refillDates = sortedPredictions
              .filter(p => p.predictedRefillDate)
              .map(p => ({
                date: p.predictedRefillDate!,
                tankName: p.tankName,
                tankId: p.tankId,
              }));

            if (refillDates.length === 0) return null;

            return (
              <CalendarWeatherOverlay
                lat={tankWithCoords.lat!}
                lng={tankWithCoords.lng!}
                refillDates={refillDates}
              />
            );
          })()}

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                How predictions work
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Refill dates are predicted based on your historical consumption patterns.
                Higher confidence predictions come from tanks with consistent usage data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UpcomingRefillRow({
  tank,
  onClick,
}: {
  tank: RefillPrediction;
  onClick: () => void;
}) {
  const urgencyColors = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    normal: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border hover:shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm',
            urgencyColors[tank.urgency]
          )}
        >
          {tank.currentLevel.toFixed(0)}%
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{tank.tankName}</p>
          {tank.predictedRefillDate && (
            <p className="text-xs text-gray-500">
              {tank.predictedRefillDate.toLocaleDateString('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </div>
        {tank.daysRemaining !== null && (
          <Badge variant="outline" className="text-xs">
            {Math.round(tank.daysRemaining)}d
          </Badge>
        )}
      </div>
    </button>
  );
}
