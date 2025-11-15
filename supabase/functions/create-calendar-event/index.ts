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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, startTime, endTime, location, description, activityId } = await req.json();
    console.log('Creating calendar event:', { userId: user.id, title, startTime, endTime });

    // Get user's calendar connection (optional)
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    let googleEventId = `local-${Date.now()}`; // Default for non-synced events
    let syncedToGoogle = false;

    // Only sync to Google Calendar if connected
    if (connection && connection.access_token) {
      try {
        // Create event in Google Calendar
        const googleEvent = {
          summary: title,
          location: location || '',
          description: description || '',
          start: {
            dateTime: startTime,
            timeZone: 'UTC',
          },
          end: {
            dateTime: endTime,
            timeZone: 'UTC',
          },
        };

        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (calendarResponse.ok) {
          const createdEvent = await calendarResponse.json();
          googleEventId = createdEvent.id;
          syncedToGoogle = true;
          console.log('Created Google Calendar event:', createdEvent.id);
        } else {
          const errorText = await calendarResponse.text();
          console.error('Google Calendar API error:', calendarResponse.status, errorText);
          
          // If token expired, log but continue with local storage
          if (calendarResponse.status === 401) {
            console.log('Access token expired, storing locally only');
          }
        }
      } catch (googleError) {
        console.error('Error syncing to Google Calendar:', googleError);
        // Continue with local storage even if Google sync fails
      }
    } else {
      console.log('No calendar connection, storing locally only');
    }

    // Store in local database (always, regardless of Google sync)
    const { data: localEvent, error: dbError } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        event_id: googleEventId,
        title: title,
        start_time: startTime,
        end_time: endTime,
        location: location || null,
        description: description || null,
        calendar_provider: syncedToGoogle ? 'google' : 'local'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save event' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If this is tied to an activity, create scheduled_activity record
    if (activityId && localEvent) {
      await supabase
        .from('scheduled_activities')
        .insert({
          user_id: user.id,
          activity_id: activityId,
          calendar_event_id: localEvent.id
        });
    }

    console.log('Event created successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      event: localEvent,
      syncedToGoogle
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});