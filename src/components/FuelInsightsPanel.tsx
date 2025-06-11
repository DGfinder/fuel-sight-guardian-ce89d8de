import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tank } from '@/types/fuel';
import { useFavourites } from '@/hooks/useFavourites';
import { useRecentDips } from '@/hooks/useRecentDips';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface FuelInsightsPanelProps {
  tanks: Tank[];
  onNeedsActionClick: () => void;
}

export function FuelInsightsPanel({ tanks, onNeedsActionClick }: FuelInsightsPanelProps) {
  const [user, setUser] = useState(null);
  const { getFavourites } = useFavourites(user?.id || '');
  const favourites = getFavourites();
  const { data: recentDips, isLoading: recentDipsLoading } = useRecentDips(30);

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
    t => !!t.last_dip?.created_at && ((t.days_to_min_level !== null && t.days_to_min_level <= 2) || t.current_level_percent <= 0.2)
  ).length;

  const favouriteTanks = tanks.filter(t => favourites.includes(t.id));
  
  const recentActivity = tanks
    .filter(t => t.last_dip?.created_at)
    .sort((a, b) => new Date(b.last_dip!.created_at).getTime() - new Date(a.last_dip!.created_at).getTime())
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
                  className="p-4 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-bold text-lg">{recentDips?.length || 0}</p>
                      <p className="text-sm text-gray-600">Recent Updates</p>
                    </div>
                  </div>
                  {recentDips && recentDips.length > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      Latest: {recentDips[0]?.tank_location}
                    </p>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent 
                side="bottom" 
                align="center" 
                className="w-[360px] max-h-[70vh] p-0 overflow-hidden shadow-lg rounded-xl animate-in slide-in-from-top-2 fade-in-0 duration-200 bg-white border border-gray-200" 
                aria-label="Recent dip entries"
                onEscapeKeyDown={() => {
                  // Focus will return to trigger automatically
                }}
              >
                <RecentDipsPanel recentDips={recentDips} isLoading={recentDipsLoading} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentDipsPanel({ recentDips, isLoading }: { recentDips?: any[], isLoading: boolean }) {
  if (isLoading) return (
    <div className="p-6 text-center text-gray-500">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
      Loading recent updates...
    </div>
  );
  
  if (!recentDips || recentDips.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No recent updates</p>
        <p className="text-xs mt-1">Dip readings will appear here</p>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto overscroll-contain bg-white">
      <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <h3 className="font-semibold text-gray-900">Recent Dip Readings</h3>
        <p className="text-xs text-gray-500">Last {recentDips.length} of 30 entries</p>
      </div>
      <div className="p-4 pb-6 bg-white">
        <ol className="relative border-l-2 border-gray-200 space-y-4">
          {recentDips.map((dip, index) => (
            <li key={dip.id} className="ml-4">
              <span className="absolute -left-2 flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full ring-4 ring-white">
                <span className="block w-2 h-2 bg-blue-500 rounded-full" />
              </span>
              
              <div className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-sm text-gray-900">
                    {dip.is_refill ? 'Depot Refill' : 'Manual Dip'}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {(() => {
                      const dipDate = new Date(dip.created_at);
                      const now = new Date();
                      const timeAgo = formatDistanceToNow(dipDate, { addSuffix: true });
                      // If the result starts with "in", it means date is in future, so we'll force it to show as "ago"
                      return timeAgo.startsWith('in ') ? timeAgo.replace('in ', '') + ' ago' : timeAgo;
                    })()}
                  </span>
                </div>
                
                <div className="text-sm text-gray-700 mb-2">
                  {dip.is_refill
                    ? `Refilled ${Number(dip.value).toLocaleString()}L of ${dip.product_type}`
                    : `Dip reading: ${Number(dip.value).toLocaleString()}L`}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 gap-2">
                  <span className="font-medium truncate">{dip.tank_location}</span>
                  <Link 
                    to={`/${dip.group_name.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-blue-600 hover:text-blue-800 underline shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                    tabIndex={0}
                  >
                    {dip.group_name}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
