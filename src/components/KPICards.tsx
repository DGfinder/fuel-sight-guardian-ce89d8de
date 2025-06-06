
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Fuel, Clock } from "lucide-react";
import { KPIData } from "@/types/fuel";

interface KPICardsProps {
  data: KPIData;
  onCardClick: (filter: string) => void;
}

export function KPICards({ data, onCardClick }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-fuel-critical"
        onClick={() => onCardClick('below10')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tanks &lt; 10%</p>
              <p className="text-2xl font-bold text-fuel-critical">{data.tanksBelow10}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-fuel-critical" />
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-fuel-warning"
        onClick={() => onCardClick('below20')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tanks &lt; 20%</p>
              <p className="text-2xl font-bold text-fuel-warning">{data.tanksBelow20}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-fuel-warning" />
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
        onClick={() => onCardClick('totalStock')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {(data.totalStock / 1000).toFixed(1)}k<span className="text-sm font-normal">L</span>
              </p>
            </div>
            <Fuel className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-gray-500"
        onClick={() => onCardClick('avgDays')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Days to Min</p>
              <p className="text-2xl font-bold text-gray-900">{data.avgDaysToEmpty}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
