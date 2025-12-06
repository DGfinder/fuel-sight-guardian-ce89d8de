import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TruckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { RoadRiskAssessment } from '@/services/weather/road-risk-calculator';

interface RoadRiskAlertProps {
  assessment: RoadRiskAssessment;
  tankId: string;
}

export function RoadRiskAlert({ assessment, tankId }: RoadRiskAlertProps) {
  const { riskLevel, probability, estimatedClosureDate, reasoning, recommendations } = assessment;

  if (riskLevel === 'low') return null; // Don't show anything for low risk

  const colors = {
    moderate: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: 'text-yellow-600 dark:text-yellow-400',
    },
    high: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-800 dark:text-orange-200',
      icon: 'text-orange-600 dark:text-orange-400',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: 'text-red-600 dark:text-red-400',
    },
  };

  const style = colors[riskLevel === 'low' ? 'moderate' : riskLevel];

  return (
    <Card className={cn('border-2', style.bg, style.border)}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn('h-6 w-6 mt-0.5', style.icon)} />
          <div className="flex-1">
            <h3 className={cn('font-semibold text-lg', style.text)}>
              {riskLevel === 'critical' && '🚨 URGENT: Road Closure Risk'}
              {riskLevel === 'high' && '⚠️ High Road Closure Risk'}
              {riskLevel === 'moderate' && 'Moderate Road Closure Risk'}
            </h3>

            <p className={cn('text-sm mt-2', style.text)}>
              {reasoning}
            </p>

            {estimatedClosureDate && (
              <p className={cn('text-sm mt-1 font-medium', style.text)}>
                Road likely impassable from:{' '}
                {estimatedClosureDate.toLocaleDateString('en-AU', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                })}
              </p>
            )}

            <div className="mt-3 space-y-1">
              {recommendations.map((rec, i) => (
                <p key={i} className={cn('text-sm flex items-start gap-2', style.text)}>
                  <span>•</span>
                  <span>{rec}</span>
                </p>
              ))}
            </div>

            {riskLevel === 'critical' && (
              <div className="mt-4">
                <Link to={`/customer/request?tank=${tankId}`}>
                  <Button variant="destructive" className="gap-2">
                    <TruckIcon size={16} />
                    Request Urgent Delivery
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
