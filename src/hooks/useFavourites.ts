import { useCallback } from 'react';
import type { Tank, UserFavourite, UserView } from '@/types/fuel';

const FAV_KEY = 'favourite_tanks';
const VIEW_KEY = 'recent_views';

export function useFavourites(userId: string) {
  // Favourites
  const getFavourites = useCallback((): string[] => {
    const raw = localStorage.getItem(`${FAV_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  }, [userId]);

  const toggleFavourite = useCallback((tankId: string) => {
    const favs = getFavourites();
    let updated;
    if (favs.includes(tankId)) {
      updated = favs.filter((id: string) => id !== tankId);
    } else {
      updated = [...favs, tankId];
    }
    localStorage.setItem(`${FAV_KEY}_${userId}`, JSON.stringify(updated));
  }, [getFavourites, userId]);

  // Recent Views
  const getRecentViews = useCallback((): UserView[] => {
    const raw = localStorage.getItem(`${VIEW_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  }, [userId]);

  const saveView = useCallback((tankId: string) => {
    const views = getRecentViews();
    const now = new Date().toISOString();
    const updated = [
      { user_id: userId, tank_id: tankId, viewed_at: now },
      ...views.filter((v: UserView) => v.tank_id !== tankId)
    ].slice(0, 10);
    localStorage.setItem(`${VIEW_KEY}_${userId}`, JSON.stringify(updated));
  }, [getRecentViews, userId]);

  return {
    getFavourites,
    toggleFavourite,
    getRecentViews,
    saveView,
  };
} 