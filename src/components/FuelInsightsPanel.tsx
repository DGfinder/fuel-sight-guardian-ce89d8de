import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';
import { useFavourites } from '@/hooks/useFavourites';
import { supabase } from '@/lib/supabase';

interface FuelInsightsPanelProps {
  tanks: Tank[];
  onNeedsActionClick: () => void;
}

export function FuelInsightsPanel({ tanks, onNeedsActionClick }: FuelInsightsPanelProps) {
  const [user, setUser] = useState(null);
  const { getFavourites } = useFavourites(user?.id || '');
  const favourites = getFavourites();

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const needsActionCount = tanks.filter(
    t => (t.days_to_min_level !== null && t.days_to_min_level <= 2) || t.current_level_percent <= 20
  ).length;

  const favouriteTanks = tanks.filter(t => favourites.includes(t.id));
  
  const recentActivity = tanks
    .filter(t => t.last_dip_date)
    .sort((a, b) => new Date(b.last_dip_date!).getTime() - new Date(a.last_dip_date!).getTime())
    .slice(0, 3);

  return (
    <Card className="mb-6 border-green-100 bg-gradient-to-r from-green-50 to-green-25">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Welcome & Status */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#008457] rounded-full">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Welcome back</p>
                <p className="font-semibold text-gray-900">{user?.email}</p>
              </div>
            </div>
            <p className="text-lg font-bold text-[#008457]">
              Monitoring {tanks.length} tanks
            </p>
          </div>

          {/* Needs Action */}
          <div className="lg:col-span-1">
            <button
              onClick={onNeedsActionClick}
              className={cn(
                "w-full p-4 rounded-lg border-2 transition-all duration-200",
                "hover:shadow-md hover:-translate-y-0.5",
                needsActionCount > 0 
                  ? "border-red-200 bg-red-50 hover:bg-red-100" 
                  : "border-green-200 bg-green-50 hover:bg-green-100"
              )}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  needsActionCount > 0 ? "text-red-600" : "text-green-600"
                )} />
                <div className="text-left">
                  <p className="font-bold text-lg">
                    {needsActionCount > 0 ? needsActionCount : '0'}
                  </p>
                  <p className="text-sm text-gray-600">Needs Action</p>
                </div>
                {needsActionCount > 0 && (
                  <Badge variant="destructive" className="ml-auto animate-pulse">
                    Alert
                  </Badge>
                )}
              </div>
            </button>
          </div>

          {/* Favourites */}
          <div className="lg:col-span-1">
            <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-3 mb-2">
                <Star className="h-5 w-5 text-yellow-600 fill-yellow-400" />
                <div>
                  <p className="font-bold text-lg">{favouriteTanks.length}</p>
                  <p className="text-sm text-gray-600">Favourites</p>
                </div>
              </div>
              {favouriteTanks.length > 0 && (
                <p className="text-xs text-gray-500 truncate">
                  Latest: {favouriteTanks[0]?.location}
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-bold text-lg">{recentActivity.length}</p>
                  <p className="text-sm text-gray-600">Recent Updates</p>
                </div>
              </div>
              {recentActivity.length > 0 && (
                <p className="text-xs text-gray-500 truncate">
                  Latest: {recentActivity[0]?.location}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
