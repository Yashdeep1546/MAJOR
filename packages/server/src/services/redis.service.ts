import Redis from 'ioredis';
import { config } from '../config.js';

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    try {
      this.client = new Redis(config.redisUrl || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1, // Don't block forever if down
        retryStrategy(times) {
          if (times > 3) {
            console.warn('[Redis] Max retries reached. Giving up on connection.');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000); // Reconnect after
        }
      });

      this.client.on('error', (err) => {
        console.warn('[Redis] Connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        this.isConnected = true;
      });
      
      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[Redis] Initialization failed:', err.message);
    }
  }

  async getConversationHistory(conversationId: string): Promise<any[] | null> {
    if (!this.isConnected || !this.client) return null;
    
    try {
      const data = await this.client.get(`chat_history:${conversationId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err: any) {
      console.warn(`[Redis] Failed to GET chat_history for ${conversationId}:`, err.message);
    }
    return null;
  }

  async setConversationHistory(conversationId: string, history: any[], ttlSeconds = 3600): Promise<void> {
    if (!this.isConnected || !this.client) return;

    try {
      await this.client.setex(`chat_history:${conversationId}`, ttlSeconds, JSON.stringify(history));
    } catch (err: any) {
      console.warn(`[Redis] Failed to SET chat_history for ${conversationId}:`, err.message);
    }
  }
}

export const redisService = new RedisService();
