/**
 * Industry Intelligence Dashboard
 *
 * Main container for mining and general/industrial customer intelligence.
 * Composes: DeliveryCard + WeatherCard + AnomalyAlert + CostCard
 * Mirrors AgIntelligenceDashboard structure for farming customers.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIndustryIntelligence } from '@/hooks/useIndustryIntelligence';
import { useCustomerFeatures } from '@/hooks/useCustomerFeatures';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RoadRiskAlert } from './RoadRiskAlert';
import { ExtremeWeatherCard } from './ExtremeWeatherCard';
import { ConsumptionAnomalyAlert } from './ConsumptionAnomalyAlert';
import { CostProjectionCard } from './CostProjectionCard';
import { GenericDeliveryCard } from './GenericDeliveryCard';
import { AlertTriangle, Activity, Gauge, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerTank } from '@/hooks/useCustomerAuth';
import type { IndustryAlert } from '@/hooks/useIndustryIntelligence';

interface IndustryIntelligenceDashboardProps {
  tank: CustomerTank | null;
  tanks?: CustomerTank[];
}

export function IndustryIntelligenceDashboard({
  tank,
  tanks = [],
}: IndustryIntelligenceDashboardProps) {
  const {
    industryType,
    proactiveDelivery,
    extremeWeatherAlerts,
    consumptionAnomalies,
    costTracking,
    roadRisk: showRoadRisk,
    agriculturalIntelligence,
  } = useCustomerFeatures();

  // Skip for farming customers (they use AgIntelligenceDashboard)
  if (agriculturalIntelligence) {
    return null;
  }

  // Get all industry intelligence
  const intelligence = useIndustryIntelligence(tank, tanks);

  const {
    extremeWeather,
    consumptionAnomaly,
    costTracking: costData,
    deliveryRecommendation,
    roadRisk,
    alerts,
    isLoading,
  } = intelligence;

  // Don't render if no features enabled
  const hasAnyFeature =
    proactiveDelivery || extremeWeatherAlerts || consumptionAnomalies || costTracking || showRoadRisk;

  if (!hasAnyFeature) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  // Count active intelligence items
  const hasDeliveryRec = proactiveDelivery && deliveryRecommendation && deliveryRecommendation.urgencyLevel !== 'good';
  const hasWeatherAlerts = extremeWeatherAlerts && extremeWeather.hasActiveAlerts;
  const hasAnomaly = consumptionAnomalies && consumptionAnomaly.currentAnomaly?.hasAnomaly;
  const hasCostData = costTracking && costData.projection;
  const hasRoadRisk = showRoadRisk && roadRisk && roadRisk.riskLevel !== 'low';

  const activeCount = [hasDeliveryRec, hasWeatherAlerts, hasAnomaly, hasCostData, hasRoadRisk].filter(Boolean).length;

  // If nothing to show, display a compact "all clear" message
  if (activeCount === 0) {
    return (
      <Card className="bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Operations Normal
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                No alerts or recommended actions at this time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Proactive Delivery - most actionable, show first */}
      {hasDeliveryRec && tank && (
        <GenericDeliveryCard
          recommendation={deliveryRecommendation!}
          tankId={tank.id}
          tankName={tank.customer_name}
          industryType={industryType}
        />
      )}

      {/* Extreme Weather Alerts */}
      {hasWeatherAlerts && (
        <ExtremeWeatherCard
          events={extremeWeather.events}
          industryType={industryType}
        />
      )}

      {/* Road Risk Alert - high priority for mining */}
      {hasRoadRisk && roadRisk && tank && (
        <RoadRiskAlert assessment={roadRisk} tankId={tank.id} />
      )}

      {/* Consumption Anomaly */}
      {hasAnomaly && consumptionAnomaly.currentAnomaly && (
        <ConsumptionAnomalyAlert
          anomaly={consumptionAnomaly.currentAnomaly}
          baseline={consumptionAnomaly.baseline}
          industryType={industryType}
        />
      )}

      {/* Cost Tracking - show even when on budget as it's informational */}
      {hasCostData && costData.projection && (
        <CostProjectionCard
          projection={costData.projection}
          budgetSummary={costData.budgetSummary}
        />
      )}

      {/* Consolidated Alerts Summary - if there are multiple */}
      {alerts.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Compact alert row for summary view
 */
function AlertRow({ alert }: { alert: IndustryAlert }) {
  const severityColors = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    alert: 'text-red-600 dark:text-red-400',
  };

  const typeIcons = {
    weather: '🌤️',
    anomaly: '📊',
    delivery: '🚛',
    budget: '💰',
  };

  return (
    <div className="text-sm flex items-start gap-2">
      <span className="text-base">{typeIcons[alert.type]}</span>
      <div className="flex-1">
        <p className={cn('font-medium', severityColors[alert.severity])}>
          {alert.title}
        </p>
        <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
          {alert.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Summary stats card for fleet-wide view
 */
export function IndustryIntelligenceSummary({
  tanks,
}: {
  tanks: CustomerTank[];
}) {
  const { industryType, costTracking } = useCustomerFeatures();
  const intelligence = useIndustryIntelligence(null, tanks);

  if (intelligence.isLoading) {
    return null;
  }

  const { alerts, costTracking: costData } = intelligence;
  const alertCount = alerts.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Fleet Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Active Alerts */}
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className={cn(
              'text-2xl font-bold',
              alertCount > 0 ? 'text-amber-600' : 'text-green-600'
            )}>
              {alertCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Active Alerts
            </div>
          </div>

          {/* Tanks Count */}
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="text-2xl font-bold text-blue-600">
              {tanks.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Monitored Tanks
            </div>
          </div>

          {/* Projected Cost */}
          {costTracking && costData.projection && (
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${costData.projection.estimatedCost.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Est. {costData.projection.periodType === 'monthly' ? 'Monthly' : 'Weekly'} Cost
              </div>
            </div>
          )}

          {/* Trend */}
          {costTracking && costData.projection && (
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className={cn(
                'text-2xl font-bold flex items-center justify-center gap-1',
                costData.projection.trend === 'up' ? 'text-red-500' :
                costData.projection.trend === 'down' ? 'text-green-500' : 'text-gray-500'
              )}>
                <TrendingUp className={cn(
                  'h-5 w-5',
                  costData.projection.trend === 'down' && 'rotate-180'
                )} />
                {costData.projection.trend === 'stable' ? '—' : ''}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Consumption Trend
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default IndustryIntelligenceDashboard;
