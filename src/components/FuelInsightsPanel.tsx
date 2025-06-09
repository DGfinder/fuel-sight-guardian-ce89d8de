import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';
import { useFavourites } from '@/hooks/useFavourites';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

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
    t => !!t.last_dip_ts && ((t.days_to_min_level !== null && t.days_to_min_level <= 2) || t.current_level_percent <= 0.2)
  ).length;

  const favouriteTanks = tanks.filter(t => favourites.includes(t.id));
  
  const recentActivity = tanks
    .filter(t => t.last_dip_ts)
    .sort((a, b) => new Date(b.last_dip_ts!).getTime() - new Date(a.last_dip_ts!).getTime())
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
            <Popover>
              <PopoverTrigger asChild>
                <div
                  role="button"
                  aria-haspopup="dialog"
                  tabIndex={0}
                  className="p-4 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                >
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
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-[360px] max-h-[70vh] p-0 overflow-hidden shadow-lg rounded-xl" aria-label="Recent dip entries">
                <RecentDipsPanel />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentDipsPanel() {
  type RecentDip = {
    id: string;
    value: number;
    created_at: string;
    product_type: string;
    tank_id: string;
    group_id: string;
    location: string;
    refill?: boolean;
  };
  const { data, isLoading } = useQuery<RecentDip[]>(['recent-dips'], async () => {
    const { data, error } = await supabase
      .from('dip_readings')
      .select('id,value,created_at,product_type,tank_id,group_id,location,refill')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  }, { staleTime: 60000 });

  const dips = (data ?? []) as RecentDip[];

  if (isLoading) return <div className="p-6 text-center text-gray-500">Loading…</div>;
  if (!dips.length) return <div className="p-6 text-center text-gray-400">No recent updates</div>;

  return (
    <div className="max-h-[70vh] w-[360px] overflow-y-auto p-4" aria-label="Recent dip entries">
      <ol className="relative border-l-2 border-gray-200">
        {dips.map((d, i) => (
          <li key={d.id} className="mb-6 ml-4">
            <span className="absolute -left-2 flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full ring-8 ring-white">
              <span className="block w-2 h-2 bg-blue-500 rounded-full" />
            </span>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm text-gray-900">
                {d.refill ? 'Depot Refill' : 'Manual Dip'}
              </span>
              <span className="text-xs text-gray-500">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
            </div>
            <div className="text-sm text-gray-700">
              {d.refill
                ? `Refilled ${Number(d.value).toLocaleString()}L of ${d.product_type}`
                : `Dip ${Number(d.value).toLocaleString()}L`}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Depot: <a href={`/depots/${d.group_id}`} className="underline text-blue-600 hover:text-blue-800">{d.location}</a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
