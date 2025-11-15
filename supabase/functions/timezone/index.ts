import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimezoneRequest {
  lat: number;
  lng: number;
}

interface TimezoneResponse {
  timezone: string;
  datetime: string;
  utc_offset: string;
  abbreviation: string;
  unixtime: number;
}

const timezoneSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    const validationResult = timezoneSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lat, lng } = validationResult.data;

    // Use WorldTimeAPI to get timezone from coordinates
    // This is a free API that doesn't require authentication
    const timezoneUrl = `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lng}`;
    
    console.log(`Calling timezone API: ${timezoneUrl}`);
    
    const timezoneResponse = await fetch(timezoneUrl);
    
    if (!timezoneResponse.ok) {
      console.error(`Timezone API error: ${timezoneResponse.status}`);
      throw new Error(`Failed to fetch timezone: ${timezoneResponse.statusText}`);
    }

    const timezoneData = await timezoneResponse.json();
    console.log('Timezone data received:', JSON.stringify(timezoneData));

    // timeapi.io already provides current time, no need for second API call
    // Extract UTC offset hours from seconds
    const offsetSeconds = timezoneData.currentUtcOffset?.seconds || 0;
    const offsetHours = offsetSeconds / 3600;
    const offsetSign = offsetHours >= 0 ? '+' : '-';
    const offsetFormatted = `${offsetSign}${Math.abs(offsetHours).toString().padStart(2, '0')}:00`;
    
    // Get abbreviation from DST info or calculate from timezone name
    const abbreviation = timezoneData.isDayLightSavingActive && timezoneData.dstInterval?.dstName
      ? timezoneData.dstInterval.dstName
      : timezoneData.timeZone.split('/').pop()?.substring(0, 3).toUpperCase() || 'UTC';

    // Convert to Unix timestamp (seconds)
    const datetime = timezoneData.currentLocalTime;
    const unixtime = Math.floor(new Date(datetime).getTime() / 1000);

    const response: TimezoneResponse = {
      timezone: timezoneData.timeZone,
      datetime: datetime,
      utc_offset: offsetFormatted,
      abbreviation: abbreviation,
      unixtime: unixtime,
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in timezone function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch timezone data';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
