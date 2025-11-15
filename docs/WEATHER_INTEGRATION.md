# Weather Integration Documentation

## Overview

This project uses **WeatherAPI.com** for real-time weather data and forecasts. The integration is production-ready with proper error handling, TypeScript types, and modular architecture.

## Architecture

```
┌─────────────────┐
│   WeatherWidget │  ← React Component (UI)
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐
│ weatherService  │  ← TypeScript Service Layer
└────────┬────────┘
         │ calls
         ▼
┌─────────────────┐
│  weather edge   │  ← Supabase Edge Function (Secure API)
│    function     │
└────────┬────────┘
         │ fetches from
         ▼
┌─────────────────┐
│  WeatherAPI.com │  ← External API
└─────────────────┘
```

## Files Structure

```
supabase/functions/weather/
  └── index.ts              # Edge function for secure API calls

src/services/
  └── weatherService.ts     # Service layer with all weather methods

src/components/
  └── WeatherWidget.tsx     # UI component with real-time weather

src/examples/
  └── weatherServiceUsage.ts # Usage examples and patterns

docs/
  └── WEATHER_INTEGRATION.md # This file
```

## Setup

### 1. API Key Configuration

The `WEATHER_API_KEY` secret is already configured in your Supabase project. This key is:
- Stored securely in Lovable Cloud
- Never exposed to the client
- Only accessible by the edge function

### 2. Get Your API Key

1. Go to [WeatherAPI.com](https://www.weatherapi.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. The key is already added to your secrets (you entered it via the secure form)

### 3. API Limits

Free tier includes:
- 1,000,000 API calls per month
- Current weather + 3-day forecast
- Realtime updates every 10 minutes

## Usage

### Basic Usage

```typescript
import { weatherService } from '@/services/weatherService';

// Get current weather by city
const weather = await weatherService.getCurrentWeatherByCity('London');
console.log(`Temperature: ${weather.current.temp_c}°C`);

// Get current weather by coordinates
const weatherByCoords = await weatherService.getCurrentWeatherByCoords(51.5074, -0.1278);

// Get forecast (1-7 days)
const forecast = await weatherService.getForecastByCity('London', 7);

// Use geolocation (automatic)
const userWeather = await weatherService.getWeatherForUserLocation();
```

### In React Components

```typescript
import { useState, useEffect } from 'react';
import { weatherService, CurrentWeather } from '@/services/weatherService';

function MyComponent() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      const data = await weatherService.getWeatherForUserLocation();
      setWeather(data);
    } catch (error) {
      console.error('Weather error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>{weather?.location.name}</h2>
      <p>{weather?.current.temp_c}°C</p>
    </div>
  );
}
```

## API Methods

### `weatherService.getCurrentWeatherByCity(city: string)`
Fetch current weather by city name.

**Parameters:**
- `city` (string): City name (e.g., "London", "New York")

**Returns:** `Promise<CurrentWeather>`

**Example:**
```typescript
const weather = await weatherService.getCurrentWeatherByCity('Tokyo');
```

### `weatherService.getCurrentWeatherByCoords(lat: number, lng: number)`
Fetch current weather by coordinates.

**Parameters:**
- `lat` (number): Latitude
- `lng` (number): Longitude

**Returns:** `Promise<CurrentWeather>`

**Example:**
```typescript
const weather = await weatherService.getCurrentWeatherByCoords(35.6762, 139.6503);
```

### `weatherService.getForecastByCity(city: string, days?: number)`
Fetch weather forecast by city.

**Parameters:**
- `city` (string): City name
- `days` (number, optional): Number of forecast days (1-7, default: 7)

**Returns:** `Promise<ForecastWeather>`

**Example:**
```typescript
const forecast = await weatherService.getForecastByCity('Paris', 5);
```

### `weatherService.getForecastByCoords(lat: number, lng: number, days?: number)`
Fetch weather forecast by coordinates.

**Parameters:**
- `lat` (number): Latitude
- `lng` (number): Longitude
- `days` (number, optional): Number of forecast days (1-7, default: 7)

**Returns:** `Promise<ForecastWeather>`

### `weatherService.getWeatherForUserLocation()`
Automatically detect user's location and fetch current weather.

**Returns:** `Promise<CurrentWeather>`

**Example:**
```typescript
try {
  const weather = await weatherService.getWeatherForUserLocation();
  console.log('Your weather:', weather.current.temp_c);
} catch (error) {
  // User denied geolocation
}
```

### `weatherService.getForecastForUserLocation(days?: number)`
Automatically detect user's location and fetch forecast.

**Returns:** `Promise<ForecastWeather>`

### `weatherService.getUserLocation()`
Get user's current coordinates using browser geolocation.

**Returns:** `Promise<{ lat: number; lng: number }>`

## Data Structures

### CurrentWeather
```typescript
{
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
```

### ForecastWeather
Extends `CurrentWeather` with:
```typescript
{
  forecast: {
    forecastday: ForecastDay[];
  };
}
```

### ForecastDay
```typescript
{
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
}
```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const weather = await weatherService.getCurrentWeatherByCity('InvalidCity');
} catch (error) {
  if (error instanceof Error) {
    console.error('Weather error:', error.message);
    // Handle specific errors:
    // - "City not found"
    // - "Geolocation not supported"
    // - "Network error"
  }
}
```

## Geolocation Support

The integration includes automatic user location detection:

1. **Browser Permission**: Requests user's permission to access location
2. **Coordinates**: Gets latitude and longitude
3. **Weather Data**: Fetches weather for that location
4. **Fallback**: Falls back to default city if permission denied

```typescript
// Automatically handles permission and errors
const weather = await weatherService.getWeatherForUserLocation();
```

## Switching Providers (Future-Proof)

The architecture is designed for easy provider switching:

1. **Replace Edge Function**: Update `supabase/functions/weather/index.ts` to call new API
2. **Update Types**: Modify interfaces in `weatherService.ts` if needed
3. **No UI Changes**: The `WeatherWidget` component doesn't need changes

Example for switching to OpenWeatherMap:

```typescript
// In supabase/functions/weather/index.ts
const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}`;

// Transform response to match your types
const transformed = {
  location: { name: data.name, ... },
  current: { temp_c: data.main.temp - 273.15, ... }
};
```

## Performance Optimization

1. **Caching**: Consider implementing client-side caching:
   ```typescript
   const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
   let cachedWeather: CurrentWeather | null = null;
   let cacheTime = 0;
   
   if (Date.now() - cacheTime < CACHE_DURATION && cachedWeather) {
     return cachedWeather;
   }
   ```

2. **Debouncing**: Debounce frequent weather requests
3. **Lazy Loading**: Load weather only when component is visible

## Security

✅ **API Key Protection**: Key stored in Supabase secrets, never exposed to client  
✅ **Edge Function**: All API calls go through secure backend  
✅ **CORS**: Properly configured headers  
✅ **Error Handling**: Sanitized error messages  

## Troubleshooting

### "Unable to load weather data"
- Check internet connection
- Verify API key is valid
- Check WeatherAPI.com status

### Geolocation errors
- User may have denied permission
- Browser may not support geolocation
- HTTPS required for geolocation (Lovable automatically uses HTTPS)

### "City not found"
- Check spelling of city name
- Try using coordinates instead
- Some cities may not be in the database

## API Documentation

Full WeatherAPI.com documentation:
- [Current Weather API](https://www.weatherapi.com/docs/#apis-realtime)
- [Forecast API](https://www.weatherapi.com/docs/#apis-forecast)
- [API Explorer](https://www.weatherapi.com/api-explorer.aspx)

## Support

For issues with:
- **WeatherAPI.com**: Contact their support or check status page
- **This integration**: Review examples in `src/examples/weatherServiceUsage.ts`
- **Edge function**: Check Supabase logs in Lovable Cloud dashboard