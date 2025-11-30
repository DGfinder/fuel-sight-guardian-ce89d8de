import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefillCalendar } from '@/components/calendar/RefillCalendar';
import { useCustomerRefillCalendar } from '@/hooks/useRefillCalendar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { calculateUrgencySummary, sortByUrgency, RefillPrediction } from '@/lib/urgency-calculator';
import { AlertTriangle, Clock, CheckCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CustomerCalendar() {
  const navigate = useNavigate();
  const { data: predictions, isLoading } = useCustomerRefillCalendar();

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Critical"
          count={summary.critical}
          description="< 3 days"
          icon={AlertTriangle}
          color="red"
        />
        <SummaryCard
          title="Warning"
          count={summary.warning}
          description="3-7 days"
          icon={Clock}
          color="yellow"
        />
        <SummaryCard
          title="Normal"
          count={summary.normal}
          description="7+ days"
          icon={CheckCircle}
          color="green"
        />
        <SummaryCard
          title="Unknown"
          count={summary.unknown}
          description="No data"
          icon={HelpCircle}
          color="gray"
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <RefillCalendar
            predictions={predictions || []}
            onTankClick={handleTankClick}
            showCustomerName={false}
          />
        </div>

        {/* Upcoming Refills List */}
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

function SummaryCard({
  title,
  count,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  count: number;
  description: string;
  icon: React.ElementType;
  color: 'red' | 'yellow' | 'green' | 'gray';
}) {
  const colorClasses = {
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
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
