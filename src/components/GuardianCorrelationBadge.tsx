import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface GuardianCorrelationBadgeProps {
  driverName?: string | null;
  correlationMethod?: string | null;
  confidence?: number | null;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

/**
 * Badge component for showing driver attribution confidence
 * Used in event listings to indicate how the driver was identified
 */
const GuardianCorrelationBadge: React.FC<GuardianCorrelationBadgeProps> = ({
  driverName,
  correlationMethod,
  confidence,
  size = 'sm',
  showIcon = true,
}) => {
  // No driver identified
  if (!driverName || !correlationMethod) {
    return (
      <Badge
        variant="outline"
        className={`${
          size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
        } bg-gray-100 text-gray-600 border-gray-300`}
      >
        {showIcon && <HelpCircle className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />}
        Unknown Driver
      </Badge>
    );
  }

  // Format confidence percentage
  const confidencePercent = confidence ? Math.round(confidence * 100) : 0;

  // Determine badge styling based on method and confidence
  const getBadgeStyle = () => {
    if (correlationMethod === 'vehicle_primary_driver') {
      return {
        className: 'bg-green-100 text-green-700 border-green-300',
        label: `Primary Driver (${confidencePercent}%)`,
        icon: CheckCircle,
      };
    }

    if (correlationMethod === 'lytx_hourly' && confidence && confidence >= 0.80) {
      return {
        className: 'bg-blue-100 text-blue-700 border-blue-300',
        label: `LYTX Match (${confidencePercent}%)`,
        icon: CheckCircle,
      };
    }

    if (correlationMethod === 'mtdata_trip') {
      return {
        className: 'bg-purple-100 text-purple-700 border-purple-300',
        label: `Trip Match (${confidencePercent}%)`,
        icon: CheckCircle,
      };
    }

    if (correlationMethod === 'lytx_daily' || (confidence && confidence < 0.60)) {
      return {
        className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        label: `Low Confidence (${confidencePercent}%)`,
        icon: AlertCircle,
      };
    }

    // Default case
    return {
      className: 'bg-gray-100 text-gray-700 border-gray-300',
      label: `Matched (${confidencePercent}%)`,
      icon: CheckCircle,
    };
  };

  const style = getBadgeStyle();
  const IconComponent = style.icon;

  return (
    <Badge
      variant="outline"
      className={`${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      } ${style.className}`}
    >
      {showIcon && <IconComponent className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />}
      {style.label}
    </Badge>
  );
};

export default GuardianCorrelationBadge;
