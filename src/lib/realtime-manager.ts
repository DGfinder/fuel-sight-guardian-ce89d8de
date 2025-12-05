import { QueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserPermissions } from '../types/auth';

class RealtimeManager {
  private static instance: RealtimeManager;
  private channel: RealtimeChannel | null = null;
  private subscribers: Set<string> = new Set();
  private queryClient: QueryClient | null = null;

  private constructor() {}

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  subscribe(subscriberId: string, userPermissions: UserPermissions) {
    // Add this subscriber to the set
    this.subscribers.add(subscriberId);

    // Only create subscription if it doesn't exist
    if (!this.channel && this.queryClient) {
      this.channel = supabase
        .channel('global_fuel_tanks_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fuel_tanks' },
          (payload) => {
            // Invalidate all tank queries (using pattern to match all variations)
            this.queryClient?.invalidateQueries({
              predicate: (query) => query.queryKey[0] === 'tanks'
            });
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Channel error:', err);
          }
        });
    }
  }

  unsubscribe(subscriberId: string) {
    // Remove this subscriber
    this.subscribers.delete(subscriberId);

    // If no more subscribers, cleanup the channel
    if (this.subscribers.size === 0 && this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

export const realtimeManager = RealtimeManager.getInstance(); 