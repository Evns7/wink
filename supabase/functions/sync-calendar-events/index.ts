import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get calendar connection
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No calendar connection found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const now = new Date();
    const expiresAt = new Date(connection.token_expires_at);

    if (now >= expiresAt && connection.refresh_token) {
      // Refresh token
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Update tokens in database
        await supabase
          .from('calendar_connections')
          .update({
            access_token: tokens.access_token,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq('id', connection.id);
      }
    }

    // Fetch events from Google Calendar
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!calendarResponse.ok) {
      const error = await calendarResponse.text();
      throw new Error(`Failed to fetch calendar events: ${error}`);
    }

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];

    console.log(`Fetched ${events.length} events from Google Calendar`);

    // Transform and save events
    const transformedEvents = events.map((event: any) => ({
      user_id: user.id,
      event_id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || null,
      start_time: event.start.dateTime || event.start.date,
      end_time: event.end.dateTime || event.end.date,
      location: event.location || null,
      is_all_day: !event.start.dateTime,
      calendar_provider: 'google',
    }));

    // Upsert events
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: upsertError } = await supabaseAdmin
      .from('calendar_events')
      .upsert(transformedEvents, { 
        onConflict: 'user_id,event_id,calendar_provider',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw upsertError;
    }

    // Update last synced time
    await supabase
      .from('calendar_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventsCount: events.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-calendar-events:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
