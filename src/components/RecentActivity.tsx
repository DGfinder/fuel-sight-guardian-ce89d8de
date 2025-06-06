
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Droplets, TruckIcon, User } from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'dip' | 'delivery' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  location: string;
  user?: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'dip',
    title: 'Dip Reading Added',
    description: '18,500L recorded',
    timestamp: '2024-06-05T16:30:00Z',
    location: 'Canningvale 2',
    user: 'Sarah Jones'
  },
  {
    id: '2',
    type: 'delivery',
    title: 'Fuel Delivery',
    description: '12,500L ULP delivered',
    timestamp: '2024-06-05T14:15:00Z',
    location: 'Swan Transit',
    user: 'External'
  },
  {
    id: '3',
    type: 'alert',
    title: 'Critical Alert',
    description: 'Tank below 10%',
    timestamp: '2024-06-05T12:45:00Z',
    location: 'Canningvale 1'
  },
  {
    id: '4',
    type: 'dip',
    title: 'Dip Reading Added',
    description: '4,200L recorded',
    timestamp: '2024-06-05T10:20:00Z',
    location: 'Geraldton Depot',
    user: 'Lisa Brown'
  },
  {
    id: '5',
    type: 'delivery',
    title: 'Fuel Delivery',
    description: '8,000L Diesel delivered',
    timestamp: '2024-06-05T09:00:00Z',
    location: 'Kalgoorlie',
    user: 'External'
  }
];

export function RecentActivity() {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'dip': return <Droplets className="w-4 h-4 text-primary" />;
      case 'delivery': return <TruckIcon className="w-4 h-4 text-green-600" />;
      case 'alert': return <Clock className="w-4 h-4 text-fuel-critical" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'dip': return <Badge variant="outline" className="text-primary border-primary">Dip</Badge>;
      case 'delivery': return <Badge className="bg-green-600 text-white">Delivery</Badge>;
      case 'alert': return <Badge className="bg-fuel-critical text-white">Alert</Badge>;
      default: return <Badge variant="outline">Event</Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffHours = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm text-gray-900 truncate">
                  {activity.title}
                </h4>
                {getActivityBadge(activity.type)}
              </div>
              <p className="text-sm text-gray-600">{activity.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{activity.location}</span>
                <span>•</span>
                <span>{formatTimeAgo(activity.timestamp)}</span>
                {activity.user && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{activity.user}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
