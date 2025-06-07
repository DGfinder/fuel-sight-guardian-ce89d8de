import React from 'react';
import { useFavourites } from '@/hooks/useFavourites';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, Star, Clock } from 'lucide-react';
import { useTanks } from '@/hooks/useTanks';

export function FavouritesPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const { getFavourites, getRecentViews } = useFavourites(userId || '');
  const { tanks } = useTanks();
  if (!userId) return null;
  const favourites = getFavourites();
  const recentViews = getRecentViews();
  const favouriteTanks = tanks?.filter(t => favourites.includes(t.id)) || [];
  const recentTanks = recentViews
    .map(v => tanks?.find(t => t.id === v.tank_id))
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="mb-6">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="text-yellow-400" />
            Favourites
          </CardTitle>
        </CardHeader>
        <CardContent>
          {favouriteTanks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No favourite tanks yet. Star tanks to add them here.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {favouriteTanks.map(tank => (
                <div key={tank.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                  <Droplets className="h-4 w-4 text-primary" />
                  <span className="font-medium">{tank.location}</span>
                  <Badge className="ml-auto">{tank.current_level_percent}%</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-blue-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTanks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent tanks viewed.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTanks.map(tank => (
                <div key={tank.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                  <Droplets className="h-4 w-4 text-primary" />
                  <span className="font-medium">{tank.location}</span>
                  <Badge className="ml-auto">{tank.current_level_percent}%</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 