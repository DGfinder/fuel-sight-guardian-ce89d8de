import { supabase } from './supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type SubscriptionCallback<T = Record<string, unknown>> = (payload: RealtimePostgresChangesPayload<T>) => void;
type UnsubscribeFunction = () => void;

interface ChannelSubscription {
  callbacks: Set<SubscriptionCallback>;
  channel: RealtimeChannel | null;
  isConnecting: boolean;
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;
  connectionTimeout: NodeJS.Timeout | null;
}

class RealtimeService {
  private channels: Map<string, ChannelSubscription> = new Map();
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private readonly connectionTimeout = 10000;

  private getNextReconnectDelay(attempts: number): number {
    // Exponential backoff with jitter
    const delay = Math.min(
      this.maxReconnectDelay,
      this.baseReconnectDelay * Math.pow(2, attempts) * (0.5 + Math.random())
    );
    return delay;
  }

  private async cleanupChannel(channelName: string) {
    const subscription = this.channels.get(channelName);
    if (!subscription) return;

    try {
      // Clear any pending timeouts
      if (subscription.reconnectTimeout) {
        clearTimeout(subscription.reconnectTimeout);
      }
      if (subscription.connectionTimeout) {
        clearTimeout(subscription.connectionTimeout);
      }

      // Unsubscribe if channel exists
      if (subscription.channel) {
        await subscription.channel.unsubscribe();
      }

      // Remove the channel subscription
      this.channels.delete(channelName);
    } catch (error) {
      console.error(`Error cleaning up channel ${channelName}:`, error);
    }
  }

  private async setupChannel(
    channelName: string,
    table: string,
    filter?: string
  ): Promise<void> {
    const subscription = this.channels.get(channelName);
    if (!subscription) return;

    if (subscription.isConnecting) {
      console.log(`Already connecting to channel ${channelName}, waiting...`);
      return;
    }

    try {
      subscription.isConnecting = true;

      // Set connection timeout
      subscription.connectionTimeout = setTimeout(() => {
        if (subscription.isConnecting) {
          console.error(`Connection timeout for channel ${channelName}`);
          this.handleChannelError(channelName);
        }
      }, this.connectionTimeout);

      // Create and subscribe to channel
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter,
          },
          (payload) => {
            subscription.callbacks.forEach(callback => {
              try {
                callback(payload);
              } catch (error) {
                console.error(`Error in subscription callback for ${channelName}:`, error);
              }
            });
          }
        )
        .subscribe((status) => {
          // Clear connection timeout
          if (subscription.connectionTimeout) {
            clearTimeout(subscription.connectionTimeout);
            subscription.connectionTimeout = null;
          }

          if (status === 'SUBSCRIBED') {
            subscription.channel = channel;
            subscription.isConnecting = false;
            subscription.reconnectAttempts = 0;
          } else if (status === 'CLOSED') {
            this.handleChannelClosed(channelName);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`Channel ${channelName} error`);
            this.handleChannelError(channelName);
          }
        });

    } catch (error) {
      console.error(`Error setting up channel ${channelName}:`, error);
      this.handleChannelError(channelName);
    }
  }

  private async handleChannelClosed(channelName: string) {
    const subscription = this.channels.get(channelName);
    if (!subscription) return;

    subscription.isConnecting = false;
    subscription.channel = null;
    subscription.reconnectAttempts++;

    if (subscription.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = this.getNextReconnectDelay(subscription.reconnectAttempts);
      console.log(`Attempting to reconnect to ${channelName} in ${delay}ms (attempt ${subscription.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      subscription.reconnectTimeout = setTimeout(() => {
        this.setupChannel(channelName, 'fuel_tanks').catch(error => {
          console.error(`Error reconnecting to ${channelName}:`, error);
        });
      }, delay);
    } else {
      console.error(`Max reconnection attempts reached for ${channelName}`);
      await this.cleanupChannel(channelName);
    }
  }

  private async handleChannelError(channelName: string) {
    const subscription = this.channels.get(channelName);
    if (!subscription) return;

    subscription.isConnecting = false;
    subscription.channel = null;
    await this.cleanupChannel(channelName);
  }

  async subscribe<T = Record<string, unknown>>(
    channelName: string,
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
    filter?: string
  ): Promise<UnsubscribeFunction> {
    // Get or create channel subscription
    let subscription = this.channels.get(channelName);
    if (!subscription) {
      subscription = {
        callbacks: new Set(),
        channel: null,
        isConnecting: false,
        reconnectAttempts: 0,
        reconnectTimeout: null,
        connectionTimeout: null,
      };
      this.channels.set(channelName, subscription);
    }

    // Add callback to set
    subscription.callbacks.add(callback as SubscriptionCallback);

    // If channel doesn't exist or is closed, set it up
    if (!subscription.channel && !subscription.isConnecting) {
      await this.setupChannel(channelName, table, filter);
    }

    // Return cleanup function
    return () => {
      const sub = this.channels.get(channelName);
      if (sub) {
        sub.callbacks.delete(callback as SubscriptionCallback);
        if (sub.callbacks.size === 0) {
          this.cleanupChannel(channelName);
        }
      }
    };
  }

  async unsubscribe(channelName: string): Promise<void> {
    await this.cleanupChannel(channelName);
  }

  async unsubscribeAll(): Promise<void> {
    const channelNames = Array.from(this.channels.keys());
    await Promise.all(channelNames.map(name => this.cleanupChannel(name)));
  }
}

// Export a singleton instance
export const realtimeService = new RealtimeService(); 