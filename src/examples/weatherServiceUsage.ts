/**
 * WeatherService Usage Examples
 * 
 * This file demonstrates how to use the WeatherService in your application.
 * The service is production-ready with proper error handling and TypeScript types.
 */

import { weatherService } from '@/services/weatherService';

// ============================================
// Example 1: Get current weather by city name
// ============================================
export const getCurrentWeatherExample = async () => {
  try {
    const weather = await weatherService.getCurrentWeatherByCity('London');
    
    console.log('City:', weather.location.name);
    console.log('Temperature:', weather.current.temp_c, '°C');
    console.log('Condition:', weather.current.condition.text);
    console.log('Humidity:', weather.current.humidity, '%');
    console.log('Wind Speed:', weather.current.wind_kph, 'km/h');
    
    return weather;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    throw error;
  }
};

// ============================================
// Example 2: Get current weather by coordinates
// ============================================
export const getCurrentWeatherByLocationExample = async () => {
  try {
    // London coordinates
    const lat = 51.5074;
    const lng = -0.1278;
    
    const weather = await weatherService.getCurrentWeatherByCoords(lat, lng);
    
    console.log('Weather at', lat, lng);
    console.log('Temperature:', weather.current.temp_c, '°C');
    
    return weather;
  } catch (error) {
    console.error('Failed to fetch weather by coordinates:', error);
    throw error;
  }
};

// ============================================
// Example 3: Get weather forecast
// ============================================
export const getForecastExample = async () => {
  try {
    const forecast = await weatherService.getForecastByCity('London', 7);
    
    console.log('7-day forecast for', forecast.location.name);
    
    forecast.forecast.forecastday.forEach(day => {
      console.log('\nDate:', day.date);
      console.log('Max Temp:', day.day.maxtemp_c, '°C');
      console.log('Min Temp:', day.day.mintemp_c, '°C');
      console.log('Condition:', day.day.condition.text);
      console.log('Chance of Rain:', day.day.daily_chance_of_rain, '%');
    });
    
    return forecast;
  } catch (error) {
    console.error('Failed to fetch forecast:', error);
    throw error;
  }
};

// ============================================
// Example 4: Get weather for user's current location (Geolocation)
// ============================================
export const getUserLocationWeatherExample = async () => {
  try {
    // This will automatically:
    // 1. Request user's permission for geolocation
    // 2. Get their coordinates
    // 3. Fetch weather for that location
    
    const weather = await weatherService.getWeatherForUserLocation();
    
    console.log('Your location:', weather.location.name);
    console.log('Temperature:', weather.current.temp_c, '°C');
    console.log('Condition:', weather.current.condition.text);
    
    return weather;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Geolocation')) {
        console.error('User denied geolocation or browser does not support it');
      }
    }
    throw error;
  }
};

// ============================================
// Example 5: Get forecast for user's location
// ============================================
export const getUserLocationForecastExample = async () => {
  try {
    const forecast = await weatherService.getForecastForUserLocation(3);
    
    console.log('3-day forecast for your location:', forecast.location.name);
    
    forecast.forecast.forecastday.forEach(day => {
      console.log(day.date, ':', day.day.avgtemp_c, '°C -', day.day.condition.text);
    });
    
    return forecast;
  } catch (error) {
    console.error('Failed to get forecast for user location:', error);
    throw error;
  }
};

// ============================================
// Example 6: React Component Usage
// ============================================
/*
import { useState, useEffect } from 'react';
import { weatherService, CurrentWeather } from '@/services/weatherService';

function MyWeatherComponent() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try user location first
      const data = await weatherService.getWeatherForUserLocation();
      setWeather(data);
    } catch (err) {
      // Fallback to default city
      try {
        const data = await weatherService.getCurrentWeatherByCity('New York');
        setWeather(data);
      } catch (fallbackErr) {
        setError('Unable to load weather');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading weather...</div>;
  if (error) return <div>{error}</div>;
  if (!weather) return null;

  return (
    <div>
      <h2>{weather.location.name}</h2>
      <p>{weather.current.temp_c}°C</p>
      <p>{weather.current.condition.text}</p>
    </div>
  );
}
*/

// ============================================
// Example 7: Error Handling Best Practices
// ============================================
export const errorHandlingExample = async () => {
  try {
    const weather = await weatherService.getCurrentWeatherByCity('InvalidCity123456');
    return weather;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message.includes('not found')) {
        console.error('City not found. Please check the city name.');
      } else if (error.message.includes('network')) {
        console.error('Network error. Please check your internet connection.');
      } else {
        console.error('An unexpected error occurred:', error.message);
      }
    }
    
    // Return fallback data or rethrow
    throw error;
  }
};

// ============================================
// Example 8: Temperature Unit Conversion
// ============================================
export const temperatureConversionExample = async () => {
  try {
    const weather = await weatherService.getCurrentWeatherByCity('Tokyo');
    
    // Both Celsius and Fahrenheit are available
    console.log('Temperature in Celsius:', weather.current.temp_c, '°C');
    console.log('Temperature in Fahrenheit:', weather.current.temp_f, '°F');
    
    // You can also convert manually if needed
    const celsiusToFahrenheit = (celsius: number) => (celsius * 9/5) + 32;
    const fahrenheitToCelsius = (fahrenheit: number) => (fahrenheit - 32) * 5/9;
    
    return weather;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    throw error;
  }
};