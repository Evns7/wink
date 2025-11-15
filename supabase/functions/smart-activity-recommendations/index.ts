import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const recommendationsSchema = z.object({
  freeBlock: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    duration: z.number().int().positive(),
    participantCount: z.number().int().positive().optional(),
  }).optional(),
  friendId: z.string().uuid().optional(),
  friendIds: z.array(z.string().uuid()).max(10).optional(),
  weather: z.object({
    temp: z.number(),
    isRaining: z.boolean(),
  }).optional(),
  refresh: z.boolean().optional(),
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
    const validationResult = recommendationsSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { freeBlock, friendId, friendIds, weather } = validationResult.data;
    console.log('Getting recommendations for user:', user.id, friendId ? 'with friend: ' + friendId : '');

    const [profileResult, preferencesResult, activityHistoryResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('preferences').select('*').eq('user_id', user.id),
      supabase
        .from('scheduled_activities')
        .select('*, activities(category)')
        .eq('user_id', user.id)
        .not('rating', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20)
    ]);

    const profile = profileResult.data;
    const userPreferences = preferencesResult.data || [];
    const activityHistory = activityHistoryResult.data || [];

    // Build history-based preferences (categories with high ratings)
    const categoryRatings: Record<string, { total: number; count: number }> = {};
    activityHistory.forEach((activity: any) => {
      const category = activity.activities?.category;
      const rating = activity.rating;
      if (category && rating) {
        if (!categoryRatings[category]) {
          categoryRatings[category] = { total: 0, count: 0 };
        }
        categoryRatings[category].total += rating;
        categoryRatings[category].count += 1;
      }
    });

    const likedCategories = Object.entries(categoryRatings)
      .filter(([_, stats]) => stats.total / stats.count >= 4) // 4+ star average
      .map(([category]) => category.toLowerCase());

    if (!profile || !profile.home_lat || !profile.home_lng) {
      return new Response(JSON.stringify({ error: 'Profile location not configured' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const selectedHobbies = userPreferences
      .filter((p: any) => p.score === 10)
      .map((p: any) => p.category);

    // Calculate midpoint if friendId is provided
    let searchLat = profile.home_lat;
    let searchLng = profile.home_lng;

    if (friendId) {
      const friendProfile = await supabase
        .from('profiles')
        .select('home_lat, home_lng')
        .eq('id', friendId)
        .single();

      if (friendProfile.data?.home_lat && friendProfile.data?.home_lng) {
        // Calculate midpoint using Haversine formula
        const lat1Rad = (profile.home_lat * Math.PI) / 180;
        const lat2Rad = (friendProfile.data.home_lat * Math.PI) / 180;
        const lng1Rad = (profile.home_lng * Math.PI) / 180;
        const lng2Rad = (friendProfile.data.home_lng * Math.PI) / 180;

        const dLng = lng2Rad - lng1Rad;
        const bx = Math.cos(lat2Rad) * Math.cos(dLng);
        const by = Math.cos(lat2Rad) * Math.sin(dLng);

        const lat3Rad = Math.atan2(
          Math.sin(lat1Rad) + Math.sin(lat2Rad),
          Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
        );

        const lng3Rad = lng1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

        searchLat = (lat3Rad * 180) / Math.PI;
        searchLng = (lng3Rad * 180) / Math.PI;

        console.log('Using midpoint location:', { lat: searchLat, lng: searchLng });
      }
    }

    console.log('Fetching nearby activities from enhanced endpoint...');
    const nearbyResponse = await fetch(`${supabaseUrl}/functions/v1/nearby-activities-enhanced`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: searchLat,
        lng: searchLng,
        radius: 5, // 5km radius from midpoint or user location
      }),
    });

    if (!nearbyResponse.ok) {
      throw new Error(`Failed to fetch nearby activities: ${nearbyResponse.statusText}`);
      throw new Error('Failed to fetch live events');
    }

    const { events: liveEvents } = await scrapeResponse.json();
    console.log(`Received ${liveEvents.length} live events`);

    if (!liveEvents || liveEvents.length === 0) {
      return new Response(
        JSON.stringify({ 
          recommendations: [],
          message: 'No live events found'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scoredEvents = liveEvents.map((event: any) => {
      let preferenceScore = 0;
      const categoryLower = activity.category?.toLowerCase() || '';

      if (selectedHobbies.some((h: string) => categoryLower.includes(h.toLowerCase()))) {
        preferenceScore = 10;
      } else if (likedCategories.includes(categoryLower)) {
        preferenceScore = 7;
      } else {
        preferenceScore = 3;
      }

      const timeFitScore = freeBlock ? 8 : 5;

      const weatherScore = weather?.isRaining
        ? ['museum', 'cinema', 'theatre', 'shopping'].some(indoor =>
            categoryLower.includes(indoor)
          )
          ? 10
          : 3
        : 8;

      const budgetScore = activity.price_level
        ? Math.max(0, 10 - Math.abs((profile.budget_max || 50) - activity.price_level * 10))
        : 7;

      const proximityScore = activity.distance
        ? Math.max(0, 10 - (activity.distance / 2))
        : 5;

      const durationScore = 8;

      const totalScore =
        (preferenceScore * 0.3) +
        (timeFitScore * 0.15) +
        (weatherScore * 0.1) +
        (budgetScore * 0.15) +
        (proximityScore * 0.2) +
        (durationScore * 0.1);

      return {
        ...activity,
        match_score: Math.round(totalScore * 10),
        total_score: Math.round(totalScore * 10),
        score_breakdown: {
          preference: preferenceScore,
          time_fit: timeFitScore,
          weather: weatherScore,
          budget: budgetScore,
          proximity: proximityScore,
          duration: durationScore,
        },
      };
    });

    // Sort by score and limit to top 10
    scoredActivities.sort((a: any, b: any) => b.total_score - a.total_score);
    const topActivities = scoredActivities.slice(0, 10);

    return new Response(
      JSON.stringify({
        recommendations: topActivities,
        count: topActivities.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
        const partialMatches = selectedHobbies.filter((hobby: string) =>
          descLower.includes(hobby.toLowerCase())
        );
        // Partial match: max 15 points (capped lower to leave room for other factors)
        scoreBreakdown.preference = Math.min(partialMatches.length * 2, 15);
      }

      if (freeBlock?.start && event.date) {
        try {
          const eventDate = new Date(event.date);
          const blockStart = new Date(freeBlock.start);
          const blockEnd = new Date(freeBlock.end);
          
          if (eventDate >= blockStart && eventDate <= blockEnd) {
            scoreBreakdown.time_fit = 20;
          } else {
            const daysDiff = Math.abs((eventDate.getTime() - blockStart.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 1) scoreBreakdown.time_fit = 15;
            else if (daysDiff <= 3) scoreBreakdown.time_fit = 10;
            else if (daysDiff <= 7) scoreBreakdown.time_fit = 5;
          }
        } catch (e) {
          scoreBreakdown.time_fit = 10;
        }
      } else {
        scoreBreakdown.time_fit = 10;
      }

      if (weather) {
        const isIndoorEvent = event.description.toLowerCase().includes('indoor') ||
                             event.location.toLowerCase().includes('indoor') ||
                             ['concert', 'theater', 'cinema', 'museum', 'gallery'].some((t: string) => 
                               eventCategory.includes(t));
        
        if (weather.isRaining && isIndoorEvent) {
          scoreBreakdown.weather = 15;
        } else if (!weather.isRaining && !isIndoorEvent) {
          scoreBreakdown.weather = 15;
        } else if (weather.isRaining && !isIndoorEvent) {
          scoreBreakdown.weather = 5;
        } else {
          scoreBreakdown.weather = 10;
        }
      } else {
        scoreBreakdown.weather = 10;
      }

      const userBudgetMax = profile.budget_max || 50;
      const eventPriceLevel = event.priceLevel || 1;
      const estimatedPrice = eventPriceLevel === 0 ? 0 : eventPriceLevel * 20;

      if (estimatedPrice === 0) {
        scoreBreakdown.budget = 15;
      } else if (estimatedPrice <= userBudgetMax) {
        scoreBreakdown.budget = 15;
      } else if (estimatedPrice <= userBudgetMax * 1.2) {
        scoreBreakdown.budget = 10;
      } else if (estimatedPrice <= userBudgetMax * 1.5) {
        scoreBreakdown.budget = 5;
      } else {
        scoreBreakdown.budget = 2;
      }

      const userLocation = profile.home_address.toLowerCase();
      const eventLocation = event.location.toLowerCase();
      
      const userParts = userLocation.split(',').map((s: string) => s.trim());
      const eventParts = eventLocation.split(',').map((s: string) => s.trim());
      
      let proximityMatch = false;
      for (const userPart of userParts) {
        for (const eventPart of eventParts) {
          if (userPart.includes(eventPart) || eventPart.includes(userPart)) {
            proximityMatch = true;
            break;
          }
        }
        if (proximityMatch) break;
      }

      scoreBreakdown.proximity = proximityMatch ? 10 : 5;

      const popularityScore = event.popularityScore || 0.5;
      scoreBreakdown.popularity = Math.round(popularityScore * 10);

      // Sum all scores and ensure it never exceeds 95 (no perfect match)
      const totalScore = Object.values(scoreBreakdown).reduce((a: any, b: any) => a + b, 0) as number;
      const finalScore = Math.min(Math.round(totalScore), 95);

      return {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: event.title,
        description: event.description,
        category: event.category,
        location: event.location,
        date: event.date,
        time: event.time,
        price: event.price,
        priceRange: event.priceRange,
        priceLevel: event.priceLevel,
        url: event.url,
        popularity: event.popularity,
        matchScore: finalScore,
        matchFactors: scoreBreakdown,
        isPerfectMatch: finalScore >= 85,
        source: 'live_eventbrite',
        link: event.url,
      };
    });

    const filteredEvents = scoredEvents.filter((e: any) => e.matchScore >= 40);
    const topEvents = filteredEvents
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 5);

    console.log(`Returning ${topEvents.length} top recommendations`);

    return new Response(
      JSON.stringify({ 
        recommendations: topEvents,
        totalEventsConsidered: liveEvents.length,
        scrapedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Recommendation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
