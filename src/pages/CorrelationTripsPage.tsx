/**
 * TRIP-DELIVERY CORRELATION PAGE (MTDATA PERSPECTIVE)
 * 
 * Accessed via: Data Centre → MtData Analytics → Delivery Correlation
 * Focus: Trip validation and route analysis
 * Context: "Was this trip associated with a billable delivery?"
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation, GitMerge, BarChart3 } from 'lucide-react';
import TripDeliveryCorrelationDashboard from '@/components/TripDeliveryCorrelationDashboard';

const CorrelationTripsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-8 w-8 text-blue-600" />
          <GitMerge className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trip-Delivery Correlation</h1>
          <p className="text-gray-600 mt-1">
            Match MTdata trips with corresponding delivery records
          </p>
        </div>
      </div>

      {/* Context Information */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Navigation className="h-5 w-5" />
            Trip Analysis Context
          </CardTitle>
          <CardDescription className="text-green-700">
            This view helps validate trip efficiency and billing correlation for MTdata trips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Navigation className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-green-800">Trip Validation</h3>
                <p className="text-sm text-green-700">
                  Verify trips resulted in actual fuel deliveries
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <h3 className="font-semibold text-green-800">Route Efficiency</h3>
                <p className="text-sm text-green-700">
                  Analyze trip performance against delivery volumes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <GitMerge className="h-5 w-5 text-orange-600 mt-1" />
              <div>
                <h3 className="font-semibold text-green-800">Billing Correlation</h3>
                <p className="text-sm text-green-700">
                  Match trips to revenue-generating deliveries
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Correlation Dashboard */}
      <TripDeliveryCorrelationDashboard />
    </div>
  );
};

export default CorrelationTripsPage;