import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTanks } from '@/hooks/useTanks';
import { Droplets, MapPin, Gauge } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function TanksPage() {
  const { tanks, isLoading, error } = useTanks();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading tanks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Error loading tanks: {error.message}</p>
      </div>
    );
  }

  const getStatusColor = (percentage: number) => {
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (percentage: number) => {
    if (percentage <= 20) return 'Critical';
    if (percentage <= 40) return 'Low';
    return 'Normal';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fuel Tanks</h1>
          <p className="text-gray-600 mt-1">Manage and monitor all fuel tanks</p>
        </div>
        <Button>
          <Droplets className="w-4 h-4 mr-2" />
          Add Tank
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tanks?.map((tank) => (
          <Card key={tank.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{tank.location}</CardTitle>
                <Badge 
                  variant={tank.current_level_percent <= 20 ? "destructive" : 
                          tank.current_level_percent <= 40 ? "secondary" : "default"}
                >
                  {getStatusText(tank.current_level_percent)}
                </Badge>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                {tank.group_name}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Level</span>
                <span className="text-lg font-bold">
                  {tank.current_level?.toLocaleString() || 'N/A'}L
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${getStatusColor(tank.current_level_percent)}`}
                  style={{ width: `${Math.min(tank.current_level_percent, 100)}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-600">
                <span>{tank.current_level_percent.toFixed(1)}% Full</span>
                <span>Safe: {tank.safe_level?.toLocaleString()}L</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <Gauge className="w-4 h-4 mr-1 text-gray-500" />
                  <span className="text-gray-600">Product:</span>
                </div>
                <span className="font-medium">{tank.product_type}</span>
              </div>

              {tank.days_to_min_level && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Days to minimum:</span>
                  <span className={`font-medium ${tank.days_to_min_level <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                    {tank.days_to_min_level.toFixed(1)} days
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {tanks?.length === 0 && (
        <div className="text-center py-12">
          <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tanks found</h3>
          <p className="text-gray-600">Get started by adding your first fuel tank.</p>
        </div>
      )}
    </div>
  );
} 