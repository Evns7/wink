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
        .order('completed_at', { ascending: false})
        .limit(20)
    ]);

    const profile = profileResult.data;
    const userPreferences = preferencesResult.data || [];
    const activityHistory = activityHistoryResult.data || [];

    // Build history-based preferences
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
      .filter(([_, stats]) => stats.total / stats.count >= 4)
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

    console.log('Fetching nearby activities from Perplexity...');
    const nearbyResponse = await fetch(`${supabaseUrl}/functions/v1/generate-activities-perplexity`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: searchLat,
        lng: searchLng,
        radius: 5,
        preferences: selectedHobbies,
        budgetMin: profile.budget_min,
        budgetMax: profile.budget_max,
        timeOfDay: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toISOString().split('T')[0],
      }),
    });

    if (!nearbyResponse.ok) {
      const errorText = await nearbyResponse.text();
      console.error('Perplexity API error:', nearbyResponse.status, errorText);
      throw new Error(`Failed to fetch nearby activities: ${nearbyResponse.statusText}`);
    }

    const nearbyData = await nearbyResponse.json();
    const nearbyActivities = nearbyData.activities || [];

    console.log(`Found ${nearbyActivities.length} nearby activities`);

    if (nearbyActivities.length === 0) {
      return new Response(
        JSON.stringify({ 
          recommendations: [],
          message: 'No activities found nearby'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perplexity calculates component scores, sum them to get match score (0-100)
    const scoredActivities = nearbyActivities.map((activity: any) => {
      // Calculate total score from component scores
      const componentSum = 
        (activity.uniqueness_score || 0) +
        (activity.preference_score || 0) +
        (activity.time_fit_score || 0) +
        (activity.budget_score || 0) +
        (activity.proximity_score || 0);
      
      // Ensure score is 0-100
      let totalScore = Math.min(100, Math.max(0, componentSum || activity.match_percentage || 50));
      
      const categoryLower = activity.category?.toLowerCase() || '';
      const nameLower = activity.name?.toLowerCase() || '';
      
      // Apply small boosts but keep within 0-100
      if (selectedHobbies.some((h: string) => categoryLower.includes(h.toLowerCase()))) {
        totalScore = Math.min(100, totalScore + 5);
      }
      
      if (likedCategories.includes(categoryLower)) {
        totalScore = Math.min(100, totalScore + 3);
      }

      // Apply penalty for bar-related activities to reduce their frequency
      const isBarRelated = 
        nameLower.includes('bar') || 
        nameLower.includes('pub') || 
        nameLower.includes('cocktail') ||
        categoryLower.includes('bar') || 
        categoryLower.includes('pub') || 
        categoryLower.includes('nightlife');
      
      if (isBarRelated) {
        totalScore = Math.max(0, totalScore - 20); // Significant penalty for bars
      }

      return {
        ...activity,
        matchScore: Math.round(totalScore),
        match_score: Math.round(totalScore), // Keep for backwards compatibility
        total_score: Math.round(totalScore),
        distance: activity.distance_km,
        score_breakdown: {
          uniqueness: activity.uniqueness_score || 0,
          preference: activity.preference_score || 0,
          time_fit: activity.time_fit_score || 0,
          budget: activity.budget_score || 0,
          proximity: activity.proximity_score || 0,
          preference_boost: selectedHobbies.some((h: string) => categoryLower.includes(h.toLowerCase())) ? 5 : 0,
          history_boost: likedCategories.includes(categoryLower) ? 3 : 0,
        },
      };
    });

    // Sort by score then distance for variety, remove duplicates
    scoredActivities.sort((a: any, b: any) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.distance - b.distance;
    });

    const uniqueActivities = scoredActivities.filter((activity: any, index: number, self: any[]) =>
      self.findIndex(t => t.id === activity.id) === index
    );

    const topActivities = uniqueActivities.slice(0, 10);

    return new Response(
      JSON.stringify({
        recommendations: topActivities,
        count: topActivities.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in smart-activity-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
