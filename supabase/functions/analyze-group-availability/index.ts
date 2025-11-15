import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  friendIds: z.array(z.string().uuid()).max(10).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

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

    const rawData = await req.json();
    const validationResult = requestSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { friendIds, startDate, endDate } = validationResult.data;
    console.log('Analyzing availability for:', { userId: user.id, friendIds, startDate, endDate });

    // Get user's profile for wake/sleep times
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('wake_time, sleep_time')
      .eq('id', user.id)
      .single();

    // Get all user IDs to analyze (user + friends)
    const allUserIds = [user.id, ...(friendIds || [])];

    // Fetch calendar events for all users
    const { data: allEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('user_id, start_time, end_time, title')
      .in('user_id', allUserIds)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time');

    if (eventsError) {
      console.error('Events fetch error:', eventsError);
      return new Response(JSON.stringify({ error: eventsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find overlapping free time blocks
    const freeBlocks = findFreeTimeBlocks(
      allEvents || [],
      allUserIds,
      startDate,
      endDate,
      userProfile?.wake_time || '08:00',
      userProfile?.sleep_time || '22:00'
    );

    console.log('Found free blocks:', freeBlocks.length);

    return new Response(JSON.stringify({ freeBlocks }), {
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

function findFreeTimeBlocks(
  events: any[],
  userIds: string[],
  startDate: string,
  endDate: string,
  wakeTime: string,
  sleepTime: string
) {
  const freeBlocks = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Iterate through each day
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const dayStr = day.toISOString().split('T')[0];
    
    // Create time slots for the day (wake to sleep)
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);
    const [sleepHour, sleepMin] = sleepTime.split(':').map(Number);
    
    const dayStart = new Date(day);
    dayStart.setHours(wakeHour, wakeMin, 0, 0);
    
    const dayEnd = new Date(day);
    dayEnd.setHours(sleepHour, sleepMin, 0, 0);

    // Get events for this day for all users
    const dayEvents = events.filter(e => {
      const eventStart = new Date(e.start_time);
      return eventStart.toISOString().split('T')[0] === dayStr;
    });

    // Find blocks where ALL users are free
    let currentTime = new Date(dayStart);
    
    while (currentTime < dayEnd) {
      const blockEnd = new Date(currentTime.getTime() + 60 * 60 * 1000); // 1 hour blocks
      
      // Check if all users are free during this block
      const allFree = userIds.every(userId => {
        const userEvents = dayEvents.filter(e => e.user_id === userId);
        return !userEvents.some(e => {
          const eventStart = new Date(e.start_time);
          const eventEnd = new Date(e.end_time);
          return (eventStart < blockEnd && eventEnd > currentTime);
        });
      });

      if (allFree && blockEnd <= dayEnd) {
        freeBlocks.push({
          start: currentTime.toISOString(),
          end: blockEnd.toISOString(),
          duration: 60, // minutes
          participantCount: userIds.length
        });
      }

      currentTime = blockEnd;
    }
  }

  return freeBlocks;
}