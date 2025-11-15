import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const weatherSchema = z.object({
  type: z.enum(['current', 'forecast']),
  city: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  days: z.number().int().min(1).max(14).optional(),
}).refine(data => data.city || (data.lat !== undefined && data.lng !== undefined), {
  message: 'Either city or coordinates (lat/lng) required',
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY');
    if (!WEATHER_API_KEY) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    const rawData = await req.json();
    const validationResult = weatherSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, city, lat, lng, days } = validationResult.data;
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