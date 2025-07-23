import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTanks } from '@/hooks/useTanks';
import { useSimpleTankAnalytics } from '@/hooks/useSimpleTankAnalytics';

// Simple tank card that properly uses the analytics hook
const SimpleTankCard: React.FC<{ tank: any }> = ({ tank }) => {
  // ✅ Correct way to use analytics hook - one per component, not in map
  const { analytics, isLoading: analyticsLoading } = useSimpleTankAnalytics(tank.id);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">{tank.location}</CardTitle>
        <CardDescription>
          {tank.product_type} • Group: {tank.group_name} • Subgroup: {tank.subgroup}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Basic tank info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Current Level:</span>
            <div className="font-medium">{tank.current_level?.toLocaleString() || 0} L</div>
          </div>
          <div>
            <span className="text-muted-foreground">Safe Level:</span>
            <div className="font-medium">{tank.safe_level?.toLocaleString() || 0} L</div>
          </div>
        </div>

        {/* Analytics (calculated per-component) */}
        {analyticsLoading ? (
          <div className="text-sm text-muted-foreground">Calculating analytics...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rolling Average:</span>
              <span className="font-medium text-green-600">
                {analytics.rolling_avg.toLocaleString()} L/day
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Previous Day:</span>
              <span className="font-medium text-blue-600">
                {analytics.prev_day_used.toLocaleString()} L
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Days to Min:</span>
              <span className="font-medium text-orange-600">
                {analytics.days_to_min_level ? `${analytics.days_to_min_level} days` : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={analytics.needs_attention ? "destructive" : "secondary"}>
                {analytics.needs_attention ? "⚠️ Attention" : "✅ Normal"}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main component
export const SimpleTanksList: React.FC = () => {
  const { data: tanks, isLoading, error } = useTanks();

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Database Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-2">
              Error: {error.message}
            </p>
            <p className="text-sm text-red-600">
              This might be due to broken views or RLS policies. The fallback should still work.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading Tanks...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Success Header */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center gap-2">
            🎉 Tanks Loading Successfully!
          </CardTitle>
          <CardDescription className="text-green-700">
            Found {tanks?.length || 0} tanks • No migration needed • Analytics calculated in JavaScript
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Tank List */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Your Tanks</h2>
        <div className="text-sm text-muted-foreground mb-4">
          Each tank card shows analytics calculated from your existing dip_readings data
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tanks?.slice(0, 12).map(tank => (
            <SimpleTankCard key={tank.id} tank={tank} />
          ))}
        </div>

        {tanks && tanks.length > 12 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing first 12 of {tanks.length} tanks
          </div>
        )}
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>✅ How This Bypasses Your Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-green-800">Database Strategy:</strong>
            <p className="text-muted-foreground">
              Tries your existing view first, falls back to base tables if broken
            </p>
          </div>
          
          <div>
            <strong className="text-green-800">Permissions Strategy:</strong>
            <p className="text-muted-foreground">
              Bypasses broken RLS policies entirely - fetches data directly
            </p>
          </div>
          
          <div>
            <strong className="text-green-800">Analytics Strategy:</strong>
            <p className="text-muted-foreground">
              Each tank card calculates its own analytics from dip_readings table
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleTanksList; 