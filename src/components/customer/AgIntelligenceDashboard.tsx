import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgriculturalIntelligence } from '@/hooks/useAgriculturalIntelligence';
import { useCustomerFeatures } from '@/hooks/useCustomerFeatures';
import { useProactiveDelivery } from '@/hooks/useProactiveDelivery';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RoadRiskAlert } from './RoadRiskAlert';
import { ProactiveDeliveryCard } from './ProactiveDeliveryCard';
import { AlertTriangle, Sprout, Wheat, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RoadProfile } from '@/services/weather/road-risk-calculator';
import type { OperationWindow } from '@/services/weather/operations-predictor';
import type { AgAlert } from '@/hooks/useAgriculturalIntelligence';
import type { CustomerTank } from '@/hooks/useCustomerAuth';

interface AgIntelligenceDashboardProps {
  lat: number;
  lng: number;
  tankId: string;
  tankLevel: number;
  dailyConsumption: number;
  capacityLiters: number;
  roadProfile?: RoadProfile | null;
  // Optional: Full tank object for proactive delivery intelligence
  tank?: CustomerTank | null;
}

export function AgIntelligenceDashboard({
  lat,
  lng,
  tankId,
  tankLevel,
  dailyConsumption,
  capacityLiters,
  roadProfile,
  tank,
}: AgIntelligenceDashboardProps) {
  const { agriculturalIntelligence, roadRisk: showRoadRisk } = useCustomerFeatures();

  // Skip agricultural intelligence for non-farming customers
  // (mining customers may still see road risk via RoadRiskAlert component directly)
  const { data: intelligence, isLoading } = useAgriculturalIntelligence(
    lat,
    lng,
    tankLevel,
    dailyConsumption,
    capacityLiters,
    roadProfile
  );

  // Get proactive delivery recommendation for farming customers
  const { recommendation: deliveryRecommendation, isLoading: deliveryLoading } = useProactiveDelivery(
    agriculturalIntelligence ? tank ?? null : null
  );

  // Don't render anything for non-farming customers
  // (general customers don't need agricultural intelligence)
  if (!agriculturalIntelligence && !showRoadRisk) {
    return null;
  }

  if (isLoading || deliveryLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!intelligence) return null;

  const { roadRisk, operations, alerts } = intelligence;

  // Filter alerts based on features - mining customers see road risk alerts only
  const visibleAlerts = agriculturalIntelligence
    ? alerts
    : alerts.filter(a => a.type === 'road_risk');

  return (
    <div className="space-y-4">
      {/* Proactive Delivery Intelligence - farming customers only */}
      {agriculturalIntelligence && deliveryRecommendation && (
        <ProactiveDeliveryCard
          recommendation={deliveryRecommendation}
          tankId={tankId}
          tankName={tank?.customer_name}
        />
      )}

      {/* Road Risk Alert - visible to farming + mining customers */}
      {showRoadRisk && roadRisk && roadRisk.riskLevel !== 'low' && (
        <RoadRiskAlert assessment={roadRisk} tankId={tankId} />
      )}

      {/* Operations Windows - farming customers only */}
      {agriculturalIntelligence && operations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Farm Operations Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {operations.map((op, i) => (
              <OperationCard key={i} operation={op} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Alerts Summary - filtered by visible features */}
      {visibleAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts ({visibleAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleAlerts.map((alert, i) => (
              <AlertRow key={i} alert={alert} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OperationCard({ operation }: { operation: OperationWindow }) {
  const icons = {
    harvest: <Wheat className="h-5 w-5" />,
    seeding: <Sprout className="h-5 w-5" />,
    spraying: <Sprout className="h-5 w-5" />,
  };

  const statusColors = {
    opening: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20',
    optimal: 'bg-green-50 border-green-200 dark:bg-green-900/20',
    closing: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20',
    closed: 'bg-gray-50 border-gray-200 dark:bg-gray-800',
  };

  return (
    <div className={cn('p-3 rounded-lg border', statusColors[operation.status])}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white dark:bg-gray-900">
          {icons[operation.operation]}
        </div>
        <div className="flex-1">
          <h4 className="font-medium capitalize">
            {operation.operation} Window {operation.status}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {operation.reasoning}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>
              {format(operation.startDate, 'MMM d')} - {format(operation.endDate, 'MMM d')}
            </span>
            <span>•</span>
            <span>Fuel: {operation.fuelImpact.expectedMultiplier}x normal usage</span>
            <span>•</span>
            <span>{operation.confidence}% confidence</span>
          </div>
          <div className="mt-2 space-y-1">
            {operation.recommendations.map((rec, i) => (
              <p key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1">
                <span>→</span>
                <span>{rec}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: AgAlert }) {
  const severityColors = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="text-sm">
      <p className={cn('font-medium', severityColors[alert.severity])}>
        {alert.title}
      </p>
      <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
        {alert.description}
      </p>
    </div>
  );
}
