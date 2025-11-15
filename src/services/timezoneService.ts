import { supabase } from "@/integrations/supabase/client";

/**
 * Interface for timezone information
 */
export interface TimezoneInfo {
  timezone: string;           // e.g., "America/New_York"
  datetime: string;           // ISO 8601 datetime string
  utcOffset: string;          // e.g., "-05:00"
  abbreviation: string;       // e.g., "EST"
  unixtime: number;          // Unix timestamp
  localTime?: Date;          // Parsed local time
}

/**
 * Interface for geolocation coordinates
 */
interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * TimezoneService - A modular service for timezone detection and management
 * 
 * Features:
 * - Detect timezone from geolocation coordinates
 * - Get current local time for any timezone
 * - Proper error handling with fallbacks
 * - Easy to swap providers (currently uses WorldTimeAPI)
 */
class TimezoneService {
  private cachedTimezone: TimezoneInfo | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Detect timezone using the user's geolocation
   * @returns Promise with timezone information or null on error
   */
  async detectTimezone(): Promise<TimezoneInfo | null> {
    try {
      // Check if we have a valid cached timezone
      if (this.cachedTimezone && Date.now() < this.cacheExpiry) {
        return this.cachedTimezone;
      }

      // Get user's coordinates via geolocation
      const coords = await this.getUserCoordinates();
      
      if (!coords) {
        console.warn('Unable to get user coordinates');
        return this.getFallbackTimezone();
      }

      // Fetch timezone from coordinates
      const timezone = await this.getTimezoneFromCoordinates(coords.lat, coords.lng);
      
      if (timezone) {
        // Cache the result
        this.cachedTimezone = timezone;
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      }

      return timezone;
    } catch (error) {
      console.error('Error detecting timezone:', error);
      return this.getFallbackTimezone();
    }
  }

  /**
   * Get timezone information from latitude and longitude
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Promise with timezone information
   */
  async getTimezoneFromCoordinates(lat: number, lng: number): Promise<TimezoneInfo | null> {
    try {
      const { data, error } = await supabase.functions.invoke('timezone', {
        body: { lat, lng }
      });

      if (error) {
        console.error('Error fetching timezone:', error);
        return null;
      }

      if (!data) {
        console.warn('No timezone data received');
        return null;
      }

      // Parse the datetime string to a Date object
      const localTime = new Date(data.datetime);

      return {
        timezone: data.timezone,
        datetime: data.datetime,
        utcOffset: data.utc_offset,
        abbreviation: data.abbreviation,
        unixtime: data.unixtime,
        localTime
      };
    } catch (error) {
      console.error('Error in getTimezoneFromCoordinates:', error);
      return null;
    }
  }

  /**
   * Get the user's current coordinates using Geolocation API
   * @returns Promise with coordinates or null on error
   */
  private getUserCoordinates(): Promise<Coordinates | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Error getting user location:', error.message);
          resolve(null);
        },
        {
          timeout: 10000,
          maximumAge: 300000, // Use cached position if less than 5 minutes old
          enableHighAccuracy: false
        }
      );
    });
  }

  /**
   * Get fallback timezone (browser's timezone)
   * @returns Fallback timezone information
   */
  private getFallbackTimezone(): TimezoneInfo {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetSign = offset >= 0 ? '+' : '-';
    const utcOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    return {
      timezone,
      datetime: now.toISOString(),
      utcOffset,
      abbreviation: 'Local',
      unixtime: Math.floor(now.getTime() / 1000),
      localTime: now
    };
  }

  /**
   * Format the local time for display
   * @param timezoneInfo - Timezone information
   * @param format - Format type ('short' | 'medium' | 'long')
   * @returns Formatted time string
   */
  formatTime(timezoneInfo: TimezoneInfo, format: 'short' | 'medium' | 'long' = 'medium'): string {
    const time = timezoneInfo.localTime || new Date(timezoneInfo.datetime);

    switch (format) {
      case 'short':
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'long':
        return time.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          timeZoneName: 'short'
        });
      case 'medium':
      default:
        return time.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true
        });
    }
  }

  /**
   * Clear the timezone cache
   */
  clearCache(): void {
    this.cachedTimezone = null;
    this.cacheExpiry = 0;
  }
}

// Export a singleton instance
export const timezoneService = new TimezoneService();
