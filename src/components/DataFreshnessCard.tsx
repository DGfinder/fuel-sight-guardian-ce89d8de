import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Info,
  Shield,
  CreditCard,
  Upload,
  BarChart3,
  TrendingUp,
  Users,
  Navigation,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataFreshnessDashboard, FreshnessStatus } from '@/api/dataFreshness';
import { formatDistanceToNow, format } from 'date-fns';
import DataAvailabilityCalendar from './DataAvailabilityCalendar';

interface DataFreshnessCardProps {
  sourceData: DataFreshnessDashboard;
  metrics?: Record<string, string>;
  onRefresh?: (sourceKey: string) => void;
  isRefreshing?: boolean;
}

const DataFreshnessCard: React.FC<DataFreshnessCardProps> = ({
  sourceData,
  metrics = {},
  onRefresh,
  isRefreshing = false
}) => {
  const [showCalendar, setShowCalendar] = useState(false);

  // Get freshness color and icon
  const getFreshnessDisplay = (status?: FreshnessStatus) => {
    switch (status) {
      case 'fresh':
        return {
          color: 'text-green-600 bg-green-100 border-green-200',
          icon: CheckCircle,
          text: 'Fresh'
        };
      case 'stale':
        return {
          color: 'text-yellow-600 bg-yellow-100 border-yellow-200',
          icon: AlertTriangle,
          text: 'Stale'
        };
      case 'very_stale':
        return {
          color: 'text-orange-600 bg-orange-100 border-orange-200',
          icon: AlertCircle,
          text: 'Very Stale'
        };
      case 'critical':
        return {
          color: 'text-red-600 bg-red-100 border-red-200',
          icon: XCircle,
          text: 'Critical'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-100 border-gray-200',
          icon: Info,
          text: 'Unknown'
        };
    }
  };

  const freshness = getFreshnessDisplay(sourceData.freshness_status);
  const FreshnessIcon = freshness.icon;
  const IconComponent = getIconComponent(sourceData.icon_name);

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const formatExactTime = (dateString?: string) => {
    if (!dateString) return 'No data available';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return format(date, 'PPP p');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
      sourceData.is_active 
        ? 'hover:scale-105 cursor-pointer' 
        : 'opacity-60 cursor-not-allowed'
    }`}>
      {sourceData.is_active ? (
        <Link to={sourceData.route_path} className="block h-full">
          <CardContent className="p-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${sourceData.color_class} text-white`}>
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  {/* Freshness Badge */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className={freshness.color}>
                          <FreshnessIcon className="w-3 h-3 mr-1" />
                          {freshness.text}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-medium">Data Freshness</p>
                          <p>Last updated: {formatLastUpdated(sourceData.last_updated_at)}</p>
                          <p>Exact time: {formatExactTime(sourceData.last_updated_at)}</p>
                          {sourceData.hours_since_update && (
                            <p>Hours since update: {Math.round(sourceData.hours_since_update * 10) / 10}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Calendar Dialog Trigger */}
                  <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowCalendar(true);
                        }}
                      >
                        <Calendar className="w-3 h-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <IconComponent className="w-5 h-5" />
                          {sourceData.display_name} - Data Availability
                        </DialogTitle>
                        <DialogDescription>
                          View data upload history and availability calendar
                        </DialogDescription>
                      </DialogHeader>
                      <DataAvailabilityCalendar sourceKey={sourceData.source_key} />
                    </DialogContent>
                  </Dialog>

                  {/* Refresh Button */}
                  {onRefresh && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2"
                      disabled={isRefreshing}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRefresh(sourceData.source_key);
                      }}
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
              
              <CardTitle className="text-xl">{sourceData.display_name}</CardTitle>
              <CardDescription className="text-sm">
                {sourceData.description}
              </CardDescription>

              {/* Freshness Progress Bar */}
              {sourceData.freshness_percentage !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Data Freshness</span>
                    <span>{Math.round(sourceData.freshness_percentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        sourceData.freshness_percentage >= 80 ? 'bg-green-500' :
                        sourceData.freshness_percentage >= 60 ? 'bg-yellow-500' :
                        sourceData.freshness_percentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(5, sourceData.freshness_percentage)}%` }}
                    />
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-0">
              {/* Original Metrics */}
              <div className="flex justify-between items-center text-sm mb-3">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {value}
                    </div>
                    <div className="text-gray-500 capitalize">
                      {key}
                    </div>
                  </div>
                ))}
              </div>

              {/* Freshness Info */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Last updated:</span>
                  </div>
                  <span className="font-medium">
                    {formatLastUpdated(sourceData.last_updated_at)}
                  </span>
                </div>
                
                {sourceData.record_count !== undefined && (
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>Records:</span>
                    <span className="font-medium">
                      {sourceData.record_count.toLocaleString()}
                    </span>
                  </div>
                )}

                {sourceData.last_upload_filename && (
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>Latest file:</span>
                    <span className="font-medium truncate max-w-32" title={sourceData.last_upload_filename}>
                      {sourceData.last_upload_filename}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </CardContent>
        </Link>
      ) : (
        <div className="h-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${sourceData.color_class} text-white opacity-60`}>
                <IconComponent className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="text-gray-500 border-gray-300">
                Coming Soon
              </Badge>
            </div>
            <CardTitle className="text-xl text-gray-500">{sourceData.display_name}</CardTitle>
            <CardDescription className="text-sm text-gray-400">
              {sourceData.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-sm text-gray-400">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div className="font-semibold">
                    {value}
                  </div>
                  <div className="capitalize">
                    {key}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </div>
      )}
    </Card>
  );
};

// Helper function to get icon component by name
function getIconComponent(iconName: string) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Shield,
    CreditCard,
    AlertTriangle,
    Upload,
    BarChart3,
    TrendingUp,
    Users,
    Navigation,
    FileText,
  };

  return iconMap[iconName] || FileText;
}

export default DataFreshnessCard;