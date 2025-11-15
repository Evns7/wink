import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng }: TimezoneRequest = await req.json();

    console.log(`Fetching timezone for coordinates: ${lat}, ${lng}`);

    if (!lat || !lng) {
      throw new Error('Latitude and longitude are required');
    }

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

    // Get current time for the detected timezone
    const timeUrl = `https://worldtimeapi.org/api/timezone/${timezoneData.timeZone}`;
    
    console.log(`Calling time API: ${timeUrl}`);
    
    const timeResponse = await fetch(timeUrl);
    
    if (!timeResponse.ok) {
      console.error(`Time API error: ${timeResponse.status}`);
      throw new Error(`Failed to fetch time: ${timeResponse.statusText}`);
    }

    const timeData = await timeResponse.json();
    console.log('Time data received');

    const response: TimezoneResponse = {
      timezone: timeData.timezone,
      datetime: timeData.datetime,
      utc_offset: timeData.utc_offset,
      abbreviation: timeData.abbreviation,
      unixtime: timeData.unixtime,
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
