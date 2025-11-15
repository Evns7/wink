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

        await supabase
          .from('calendar_connections')
          .update({
            access_token: tokens.access_token,
            token_expires_at: newExpiresAt.toISOString(),
          })
          .eq('id', connection.id);
      }
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch ALL calendars
    console.log('Fetching calendar list...');
    const calendarListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calendarListResponse.ok) {
      throw new Error(`Failed to fetch calendar list: ${calendarListResponse.statusText}`);
    }

    const calendarListData = await calendarListResponse.json();
    const calendars = calendarListData.items || [];
    
    console.log(`Found ${calendars.length} calendars`);

    // Delete old events for this user first
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id);

    let totalEventsInserted = 0;

    // Fetch events from ALL calendars
    for (const calendar of calendars) {
      if (!calendar.selected) continue;

      console.log(`Fetching events from calendar: ${calendar.summary}`);

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!eventsResponse.ok) {
        console.error(`Failed to fetch events from ${calendar.summary}`);
        continue;
      }

      const eventsData = await eventsResponse.json();
      const items = eventsData.items || [];

      console.log(`Found ${items.length} events in ${calendar.summary}`);

      const eventsToInsert = items
        .filter((item: any) => item.start?.dateTime || item.start?.date)
        .map((item: any) => ({
          user_id: user.id,
          event_id: `${calendar.id}_${item.id}`,
          calendar_provider: 'google',
          title: item.summary || 'Untitled Event',
          description: item.description || null,
          start_time: item.start.dateTime || item.start.date,
          end_time: item.end?.dateTime || item.end?.date || item.start.dateTime || item.start.date,
          location: item.location || null,
          is_all_day: !item.start.dateTime,
        }));

      if (eventsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(eventsToInsert);

        if (insertError) {
          console.error(`Error inserting events from ${calendar.summary}:`, insertError);
        } else {
          totalEventsInserted += eventsToInsert.length;
        }
      }
    }

    // Update last synced timestamp
    await supabase
      .from('calendar_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        calendarsProcessed: calendars.filter((c: any) => c.selected).length,
        eventsInserted: totalEventsInserted,
        message: `Synced ${totalEventsInserted} events from ${calendars.filter((c: any) => c.selected).length} calendars`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
