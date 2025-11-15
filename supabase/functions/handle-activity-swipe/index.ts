import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const swipeSchema = z.object({
  friendId: z.string().uuid(),
  activityId: z.string().uuid(),
  response: z.enum(['accept', 'reject']),
  suggestedTime: z.string().datetime(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawData = await req.json();
    const validationResult = swipeSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { friendId, activityId, response, suggestedTime } = validationResult.data;

    console.log(`User ${user.id} swiped ${response} on activity ${activityId} with friend ${friendId} at ${suggestedTime}`);

    // Record the swipe
    const { data: swipeData, error: swipeError } = await supabaseClient
      .from('activity_swipes')
      .insert({
        user_id: user.id,
        friend_id: friendId,
        activity_id: activityId,
        response: response,
        suggested_time: suggestedTime,
      })
      .select()
      .single();

    if (swipeError) {
      console.error('Error recording swipe:', swipeError);
      return new Response(JSON.stringify({ error: swipeError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If user accepted, check for a match
    let isMatch = false;
    if (response === 'accept') {
      const { data: matchData, error: matchError } = await supabaseClient
        .rpc('check_activity_match', {
          p_user_id: user.id,
          p_friend_id: friendId,
          p_activity_id: activityId,
          p_suggested_time: suggestedTime,
        });

      if (matchError) {
        console.error('Error checking for match:', matchError);
      } else {
        isMatch = matchData;
        console.log(`Match status: ${isMatch}`);
      }

      // If it's a match, update both swipes and create calendar events
      if (isMatch) {
        const now = new Date().toISOString();
        
        // Update both swipes with matched_at timestamp
        const { error: updateError } = await supabaseClient
          .from('activity_swipes')
          .update({ matched_at: now })
          .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId},activity_id.eq.${activityId},suggested_time.eq.${suggestedTime}),and(user_id.eq.${friendId},friend_id.eq.${user.id},activity_id.eq.${activityId},suggested_time.eq.${suggestedTime})`);

        if (updateError) {
          console.error('Error updating matched swipes:', updateError);
        }

        // Get activity details for the calendar event
        const { data: activity, error: activityError } = await supabaseClient
          .from('activities')
          .select('name, address')
          .eq('id', activityId)
          .single();

        if (activityError) {
          console.error('Error fetching activity:', activityError);
        } else {
          // Create calendar events for both users
          const startTime = new Date(suggestedTime);
          const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

          // Create calendar event for current user
          try {
            await supabaseClient.functions.invoke('create-calendar-event', {
              body: {
                title: `Wink: ${activity.name}`,
                description: `Matched activity with your friend!`,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                location: activity.address,
                activityId: activityId,
              },
            });
          } catch (error) {
            console.error('Error creating calendar event for user:', error);
          }

          // Note: We can't directly create calendar events for the friend
          // They would need to accept the calendar event through their own flow
          console.log('Calendar event created for user');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        swipe: swipeData,
        isMatch,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handle-activity-swipe:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
