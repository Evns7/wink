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
    participantCount: z.number().int().positive(),
  }).optional(),
  friendIds: z.array(z.string().uuid()).max(10).optional(),
  weather: z.object({
    temp: z.number(),
    isRaining: z.boolean(),
  }).optional(),
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

    const { freeBlock, friendIds, weather } = validationResult.data;
    console.log('Getting recommendations for:', { userId: user.id, freeBlock, friendIds, weather });

    // Get user profile and preferences
    const [profileResult, preferencesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('preferences').select('*').eq('user_id', user.id)
    ]);

    const profile = profileResult.data;
    const userPreferences = preferencesResult.data || [];

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get friend preferences if group activity
    let friendPreferences: any[] = [];
    if (friendIds && friendIds.length > 0) {
      const { data } = await supabase
        .from('preferences')
        .select('*')
        .in('user_id', friendIds);
      friendPreferences = data || [];
    }

    // Fetch nearby activities (within 10km)
    const { data: activities, error: activitiesError } = await supabase
      .rpc('nearby_activities', {
        user_lat: profile.home_lat,
        user_lng: profile.home_lng,
        radius_km: 10
      });

    if (activitiesError) {
      console.error('Activities fetch error:', activitiesError);
    }

    const allActivities = activities || [];

    // Score and rank activities
    const scoredActivities = allActivities.map((activity: any) => {
      let score = 0;
      const factors: any = {};

      // 1. User preference match (40% weight)
      const userPref = userPreferences.find(p => p.category === activity.category);
      const userPrefScore = userPref ? userPref.score : 0.5;
      score += userPrefScore * 40;
      factors.userPreference = userPrefScore;

      // 2. Friend preference alignment (20% weight if group)
      if (friendPreferences.length > 0) {
        const friendScores = friendPreferences
          .filter(p => p.category === activity.category)
          .map(p => p.score);
        const avgFriendScore = friendScores.length > 0
          ? friendScores.reduce((a, b) => a + b, 0) / friendScores.length
          : 0.3;
        score += avgFriendScore * 20;
        factors.friendAlignment = avgFriendScore;
      }

      // 3. Weather compatibility (15% weight)
      const weatherScore = getWeatherScore(activity, weather);
      score += weatherScore * 15;
      factors.weatherMatch = weatherScore;

      // 4. Time of day appropriateness (10% weight)
      const timeScore = getTimeScore(activity, freeBlock?.start);
      score += timeScore * 10;
      factors.timeAppropriate = timeScore;

      // 5. Budget fit (10% weight)
      const budgetScore = getBudgetScore(activity, profile);
      score += budgetScore * 10;
      factors.budgetFit = budgetScore;

      // 6. Distance/travel time (5% weight - closer is better)
      const distance = activity.distance || 5; // km
      const distanceScore = Math.max(0, 1 - (distance / 20));
      score += distanceScore * 5;
      factors.proximity = distanceScore;

      return {
        ...activity,
        matchScore: Math.round(score),
        matchFactors: factors,
        travelTimeMinutes: Math.round(distance * 3), // rough estimate: 3 min per km
        isPerfectMatch: score >= 80
      };
    });

    // Sort by score and return top 10
    const topActivities = scoredActivities
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 10);

    console.log('Top recommendations:', topActivities.length);

    return new Response(JSON.stringify({ recommendations: topActivities }), {
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

function getWeatherScore(activity: any, weather: any): number {
  if (!weather) return 0.7; // neutral if no weather data

  const isGoodWeather = weather.temp > 15 && !weather.isRaining;
  const category = activity.category.toLowerCase();
  
  // Outdoor categories
  const outdoorCategories = ['parks', 'sports', 'recreation', 'nature'];
  const isOutdoor = outdoorCategories.some(cat => category.includes(cat));

  if (isOutdoor) {
    return isGoodWeather ? 1.0 : 0.3;
  }

  // Indoor activities benefit from bad weather
  return isGoodWeather ? 0.7 : 0.9;
}

function getTimeScore(activity: any, startTime?: string): number {
  if (!startTime) return 0.7;

  const hour = new Date(startTime).getHours();
  const category = activity.category.toLowerCase();

  // Morning activities (6-11)
  if (hour >= 6 && hour < 11) {
    if (category.includes('cafe') || category.includes('breakfast') || 
        category.includes('park') || category.includes('gym')) {
      return 1.0;
    }
  }

  // Lunch (11-14)
  if (hour >= 11 && hour < 14) {
    if (category.includes('restaurant') || category.includes('food') || 
        category.includes('cafe')) {
      return 1.0;
    }
  }

  // Afternoon (14-18)
  if (hour >= 14 && hour < 18) {
    if (category.includes('shopping') || category.includes('museum') || 
        category.includes('entertainment')) {
      return 1.0;
    }
  }

  // Evening (18-22)
  if (hour >= 18 && hour < 22) {
    if (category.includes('restaurant') || category.includes('bar') || 
        category.includes('entertainment') || category.includes('cinema')) {
      return 1.0;
    }
  }

  return 0.6; // default moderate score
}

function getBudgetScore(activity: any, profile: any): number {
  const priceLevel = activity.price_level || 2; // 1-5 scale
  const userMaxBudget = profile.budget_max || 100;

  // Rough price estimates per level
  const estimatedPrices = [0, 10, 25, 50, 100, 200];
  const estimatedPrice = estimatedPrices[priceLevel] || 25;

  if (estimatedPrice <= userMaxBudget) {
    return 1.0;
  }

  // Penalty for over budget
  const overBudgetRatio = estimatedPrice / userMaxBudget;
  return Math.max(0, 1 - (overBudgetRatio - 1));
}