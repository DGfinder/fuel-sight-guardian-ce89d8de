import { motion } from 'framer-motion';
import { Fuel, Calendar } from 'lucide-react';
import { RefillPrediction, getUrgencyColor } from '@/lib/urgency-calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RefillTimelineStripProps {
  predictions: RefillPrediction[];
  maxDays?: number;
  onTankClick?: (tankId: string) => void;
}

export function RefillTimelineStrip({
  predictions,
  maxDays = 30,
  onTankClick,
}: RefillTimelineStripProps) {
  // Filter to only predictions with valid days remaining
  const validPredictions = predictions.filter(
    (p) => p.daysRemaining !== null && p.daysRemaining >= 0
  );

  // Sort by days remaining
  const sortedPredictions = [...validPredictions].sort(
    (a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)
  );

  // Day markers for the scale
  const dayMarkers = [0, 7, 14, 21, maxDays];

  const getPosition = (days: number) => {
    return Math.min((days / maxDays) * 100, 100);
  };

  const getUrgencyBgClass = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'normal':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getUrgencyTextClass = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'normal':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  if (sortedPredictions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Refill Timeline
          </h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No tanks with predicted refill dates
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Refill Timeline
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({sortedPredictions.length} tank{sortedPredictions.length !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600 dark:text-gray-400">&lt;3 days</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">3-7 days</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">7+ days</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Background track */}
        <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 dark:from-red-900/30 dark:via-yellow-900/30 dark:to-green-900/30 rounded-full" />

        {/* Day markers */}
        <div className="relative h-6 mt-1">
          {dayMarkers.map((day) => (
            <div
              key={day}
              className="absolute transform -translate-x-1/2"
              style={{ left: `${getPosition(day)}%` }}
            >
              <div className="h-2 w-px bg-gray-300 dark:bg-gray-600" />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                {day === 0 ? 'Today' : `${day}d`}
              </span>
            </div>
          ))}
        </div>

        {/* Tank markers */}
        <TooltipProvider>
          <div className="relative mt-4 min-h-[80px]">
            {sortedPredictions.map((prediction, index) => {
              const position = getPosition(prediction.daysRemaining ?? 0);
              // Stagger vertically if markers would overlap
              const row = index % 2;

              return (
                <motion.div
                  key={prediction.tankId}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="absolute"
                  style={{
                    left: `${position}%`,
                    top: row === 0 ? '0px' : '44px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTankClick?.(prediction.tankId)}
                        className={cn(
                          'flex flex-col items-center gap-1 transition-transform hover:scale-110 focus:outline-none',
                          onTankClick && 'cursor-pointer'
                        )}
                      >
                        {/* Marker dot */}
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 shadow-md flex items-center justify-center',
                            getUrgencyBgClass(prediction.urgency)
                          )}
                        >
                          <Fuel className="w-2 h-2 text-white" />
                        </div>
                        {/* Label */}
                        <div className="text-center max-w-[80px]">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                            {prediction.tankName.length > 12
                              ? prediction.tankName.substring(0, 12) + '...'
                              : prediction.tankName}
                          </div>
                          <div
                            className={cn(
                              'text-xs font-bold',
                              getUrgencyTextClass(prediction.urgency)
                            )}
                          >
                            {prediction.daysRemaining}d
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold">{prediction.tankName}</div>
                        <div className="text-sm text-gray-500">
                          {prediction.address}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            <strong>{Math.round(prediction.currentLevel)}%</strong> full
                          </span>
                          <span>
                            <strong>{prediction.daysRemaining}</strong> days remaining
                          </span>
                        </div>
                        {prediction.dailyConsumption && (
                          <div className="text-sm text-gray-500">
                            ~{Math.round(prediction.dailyConsumption)} L/day consumption
                          </div>
                        )}
                        {prediction.predictedRefillDate && (
                          <div className="text-sm text-gray-500">
                            Predicted refill:{' '}
                            {prediction.predictedRefillDate.toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
