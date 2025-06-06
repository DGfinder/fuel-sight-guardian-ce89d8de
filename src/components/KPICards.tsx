
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Fuel, Clock, CheckCircle } from "lucide-react";
import { KPIData } from "@/types/fuel";

interface KPICardsProps {
  data: KPIData;
  onCardClick: (filter: string) => void;
}

export function KPICards({ data, onCardClick }: KPICardsProps) {
  const getCardStyle = (count: number, type: 'critical' | 'warning' | 'info') => {
    if (count === 0) {
      return {
        borderColor: 'border-l-fuel-safe',
        bgColor: 'bg-white hover:bg-green-50',
        icon: <CheckCircle className="w-8 h-8 text-fuel-safe" />
      };
    }
    
    switch (type) {
      case 'critical':
        return {
          borderColor: 'border-l-fuel-critical',
          bgColor: 'bg-red-50 hover:bg-red-100',
          icon: <AlertTriangle className="w-8 h-8 text-fuel-critical" />
        };
      case 'warning':
        return {
          borderColor: 'border-l-fuel-warning',
          bgColor: 'bg-yellow-50 hover:bg-yellow-100',
          icon: <AlertTriangle className="w-8 h-8 text-fuel-warning" />
        };
      default:
        return {
          borderColor: 'border-l-primary',
          bgColor: 'bg-white hover:bg-gray-50',
          icon: <TrendingDown className="w-8 h-8 text-fuel-warning" />
        };
    }
  };

  const below20Style = getCardStyle(data.tanksBelow20, 'warning');
  const criticalDaysStyle = getCardStyle(data.tanksBelow10, 'critical'); // Using below10 as proxy for ≤2 days

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card 
        className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${below20Style.borderColor} ${below20Style.bgColor}`}
        onClick={() => onCardClick('below20')}
        role="button"
        aria-label={`${data.tanksBelow20} tanks below 20% capacity`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tanks below 20%</p>
              <p className={`text-2xl font-bold ${data.tanksBelow20 > 0 ? 'text-fuel-warning' : 'text-fuel-safe'}`}>
                {data.tanksBelow20}
              </p>
            </div>
            {below20Style.icon}
          </div>
        </CardContent>
      </Card>

      <Card 
        className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${criticalDaysStyle.borderColor} ${criticalDaysStyle.bgColor}`}
        onClick={() => onCardClick('criticalDays')}
        role="button"
        aria-label={`${data.tanksBelow10} tanks with 2 days or less to minimum`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tanks with ≤ 2 Days to Min</p>
              <p className={`text-2xl font-bold ${data.tanksBelow10 > 0 ? 'text-fuel-critical' : 'text-fuel-safe'}`}>
                {data.tanksBelow10}
              </p>
            </div>
            {criticalDaysStyle.icon}
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-primary bg-white hover:bg-gray-50"
        onClick={() => onCardClick('totalStock')}
        role="button"
        aria-label={`Total stock: ${(data.totalStock / 1000).toFixed(0)} thousand litres`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {(data.totalStock / 1000).toFixed(0)}<span className="text-lg font-normal"> 000 L</span>
              </p>
            </div>
            <Fuel className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-gray-500 bg-white hover:bg-gray-50"
        onClick={() => onCardClick('avgDays')}
        role="button"
        aria-label={`Average days to minimum: ${data.avgDaysToEmpty} days`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Days-to-Min</p>
              <p className="text-2xl font-bold text-gray-900">{data.avgDaysToEmpty}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
