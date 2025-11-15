import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY');
    if (!WEATHER_API_KEY) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    const { type, city, lat, lng, days } = await req.json();
    console.log('Weather request:', { type, city, lat, lng, days });

    let url: string;
    
    if (type === 'current') {
      // Current weather
      if (lat && lng) {
        url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lng}&aqi=no`;
      } else if (city) {
        url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&aqi=no`;
      } else {
        throw new Error('Either city or coordinates (lat/lng) required');
      }
    } else if (type === 'forecast') {
      // Forecast weather
      const forecastDays = days || 7;
      if (lat && lng) {
        url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lng}&days=${forecastDays}&aqi=no&alerts=no`;
      } else if (city) {
        url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=${forecastDays}&aqi=no&alerts=no`;
      } else {
        throw new Error('Either city or coordinates (lat/lng) required');
      }
    } else {
      throw new Error('Invalid type. Use "current" or "forecast"');
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WeatherAPI error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch weather data',
          details: errorText,
          status: response.status 
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    console.log('Weather data fetched successfully');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Weather function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});