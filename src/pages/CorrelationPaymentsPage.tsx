/**
 * TRIP-DELIVERY CORRELATION PAGE (PAYMENTS PERSPECTIVE)
 * 
 * Accessed via: Data Centre → Captive Payments → Trip Correlation
 * Focus: Payment verification and delivery matching
 * Context: "Did this payment correspond to an actual delivery?"
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Target, TrendingUp } from 'lucide-react';
import TripDeliveryCorrelationDashboard from '@/components/TripDeliveryCorrelationDashboard';

const CorrelationPaymentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-blue-600" />
          <Target className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment-Trip Correlation</h1>
          <p className="text-gray-600 mt-1">
            Verify captive payments against actual trip deliveries
          </p>
        </div>
      </div>

      {/* Context Information */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <CreditCard className="h-5 w-5" />
            Payment Verification Context
          </CardTitle>
          <CardDescription className="text-blue-700">
            This view helps validate that captive payment records correspond to actual trip deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-800">Payment Matching</h3>
                <p className="text-sm text-blue-700">
                  Match BOL numbers and customer names with trip locations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-green-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-800">Delivery Verification</h3>
                <p className="text-sm text-blue-700">
                  Confirm delivery dates align with trip timing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-800">Billing Accuracy</h3>
                <p className="text-sm text-blue-700">
                  Ensure payments match actual fuel deliveries
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

export default CorrelationPaymentsPage;