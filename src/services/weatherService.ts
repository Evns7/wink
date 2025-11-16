import { supabase } from "@/integrations/supabase/client";

export interface CurrentWeather {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    localtime: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    humidity: number;
    feelslike_c: number;
    feelslike_f: number;
    uv: number;
  };
}

export interface HourlyForecast {
  time: string;
  time_epoch: number;
  temp_c: number;
  temp_f: number;
  condition: {
    text: string;
    icon: string;
    code: number;
  };
  wind_mph: number;
  wind_kph: number;
  humidity: number;
  feelslike_c: number;
  feelslike_f: number;
}

export interface ForecastDay {
  date: string;
  day: {
    maxtemp_c: number;
    maxtemp_f: number;
    mintemp_c: number;
    mintemp_f: number;
    avgtemp_c: number;
    avgtemp_f: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    daily_chance_of_rain: number;
    daily_chance_of_snow: number;
  };
  hour: HourlyForecast[];
}

export interface ForecastWeather extends CurrentWeather {
  forecast: {
    forecastday: ForecastDay[];
  };
}

export interface WeatherError {
  error: string;
  details?: string;
  status?: number;
}

class WeatherService {
  /**
   * Fetch current weather by city name
   */
  async getCurrentWeatherByCity(city: string): Promise<CurrentWeather> {
    try {
      const { data, error } = await supabase.functions.invoke('weather', {
        body: { type: 'current', city }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as CurrentWeather;
    } catch (error) {
      console.error('Error fetching weather by city:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch current weather by coordinates
   */
  async getCurrentWeatherByCoords(lat: number, lng: number): Promise<CurrentWeather> {
    try {
      const { data, error } = await supabase.functions.invoke('weather', {
        body: { type: 'current', lat, lng }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as CurrentWeather;
    } catch (error) {
      console.error('Error fetching weather by coords:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch weather forecast by city name
   * @param city - City name
   * @param days - Number of days (1-7, default: 7)
   */
  async getForecastByCity(city: string, days: number = 7): Promise<ForecastWeather> {
    try {
      const { data, error } = await supabase.functions.invoke('weather', {
        body: { type: 'forecast', city, days }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as ForecastWeather;
    } catch (error) {
      console.error('Error fetching forecast by city:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch weather forecast by coordinates
   * @param lat - Latitude
   * @param lng - Longitude
   * @param days - Number of days (1-7, default: 7)
   */
  async getForecastByCoords(lat: number, lng: number, days: number = 7): Promise<ForecastWeather> {
    try {
      const { data, error } = await supabase.functions.invoke('weather', {
        body: { type: 'forecast', lat, lng, days }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as ForecastWeather;
    } catch (error) {
      console.error('Error fetching forecast by coords:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get user's current location using browser geolocation
   */
  async getUserLocation(): Promise<{ lat: number; lng: number }> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Fetch weather for user's current location
   */
  async getWeatherForUserLocation(): Promise<CurrentWeather> {
    try {
      const { lat, lng } = await this.getUserLocation();
      return await this.getCurrentWeatherByCoords(lat, lng);
    } catch (error) {
      console.error('Error fetching weather for user location:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch forecast for user's current location
   */
  async getForecastForUserLocation(days: number = 7): Promise<ForecastWeather> {
    try {
      const { lat, lng } = await this.getUserLocation();
      return await this.getForecastByCoords(lat, lng, days);
    } catch (error) {
      console.error('Error fetching forecast for user location:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unknown error occurred while fetching weather data');
  }
}

// Export singleton instance
export const weatherService = new WeatherService();

// Example usage:
/*
import { weatherService } from '@/services/weatherService';

// Get current weather by city
const weather = await weatherService.getCurrentWeatherByCity('London');
console.log(`Temperature: ${weather.current.temp_c}°C`);

// Get current weather by coordinates
const weatherByCoords = await weatherService.getCurrentWeatherByCoords(51.5074, -0.1278);

// Get forecast
const forecast = await weatherService.getForecastByCity('London', 7);
forecast.forecast.forecastday.forEach(day => {
  console.log(`${day.date}: ${day.day.avgtemp_c}°C - ${day.day.condition.text}`);
});

// Get weather for user's location (with geolocation)
try {
  const userWeather = await weatherService.getWeatherForUserLocation();
  console.log(`Your weather: ${userWeather.current.temp_c}°C`);
} catch (error) {
  console.error('Failed to get user location weather:', error);
}
*/