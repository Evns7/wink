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

    // Get friend profiles and preferences if group activity
    let friendProfiles: any[] = [];
    let friendPreferences: any[] = [];
    if (friendIds && friendIds.length > 0) {
      const [friendProfilesResult, friendPrefsResult] = await Promise.all([
        supabase.from('profiles').select('*').in('id', friendIds),
        supabase.from('preferences').select('*').in('user_id', friendIds)
      ]);
      friendProfiles = friendProfilesResult.data || [];
      friendPreferences = friendPrefsResult.data || [];
    }

    // Calculate midpoint between users for proximity scoring
    let centerLat = profile.home_lat;
    let centerLng = profile.home_lng;
    if (friendProfiles.length > 0) {
      const allLats = [profile.home_lat, ...friendProfiles.map(f => f.home_lat)].filter(Boolean);
      const allLngs = [profile.home_lng, ...friendProfiles.map(f => f.home_lng)].filter(Boolean);
      centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
      centerLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;
    }

    // Fetch nearby activities (within 5km of midpoint)
    const { data: activities, error: activitiesError } = await supabase
      .rpc('nearby_activities', {
        user_lat: centerLat,
        user_lng: centerLng,
        radius_km: 5
      });

    if (activitiesError) {
      console.error('Activities fetch error:', activitiesError);
    }

    const allActivities = activities || [];

    // Enhanced 6-factor scoring system (weights: 30-20-15-15-10-10)
    const scoredActivities = allActivities.map((activity: any) => {
      const scoreBreakdown: any = {
        preference: 0,
        time_fit: 0,
        weather: 0,
        budget: 0,
        proximity: 0,
        duration: 0,
      };

      // 1. Preference Match (30 points) - average of user + friends
      const userPref = userPreferences.find(p => p.category === activity.category);
      const userPrefScore = userPref ? userPref.score : 0.5;
      
      if (friendPreferences.length > 0) {
        const friendScores = friendPreferences
          .filter(p => p.category === activity.category)
          .map(p => p.score);
        const avgFriendScore = friendScores.length > 0 
          ? friendScores.reduce((a, b) => a + b, 0) / friendScores.length 
          : 0.5;
        scoreBreakdown.preference = Math.round(((userPrefScore + avgFriendScore) / 2) * 30);
      } else {
        scoreBreakdown.preference = Math.round(userPrefScore * 30);
      }

      // 2. Time of Day Fit (20 points)
      if (freeBlock?.start) {
        const hour = new Date(freeBlock.start).getHours();
        const category = activity.category.toLowerCase();
        let timeFitScore = 0.5; // default

        // Food: High at meal times
        if (category.includes('restaurant') || category.includes('cafe') || category.includes('bar')) {
          if ((hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21)) {
            timeFitScore = 1;
          } else if (hour >= 15 && hour <= 17) {
            timeFitScore = 0.7;
          }
        }
        // Sports: High morning/evening
        else if (category.includes('sport') || category.includes('gym')) {
          if ((hour >= 6 && hour <= 10) || (hour >= 17 && hour <= 20)) {
            timeFitScore = 1;
          } else if (hour >= 11 && hour <= 16) {
            timeFitScore = 0.6;
          }
        }
        // Study/Work: High mornings
        else if (category.includes('library') || category.includes('coworking')) {
          if (hour >= 8 && hour <= 12) {
            timeFitScore = 1;
          } else if (hour >= 13 && hour <= 17) {
            timeFitScore = 0.7;
          }
        }
        // Shopping: High daytime
        else if (category.includes('shop') || category.includes('mall')) {
          if (hour >= 10 && hour <= 20) {
            timeFitScore = 1;
          } else {
            timeFitScore = 0.4;
          }
        }
        // Entertainment: High evenings
        else if (category.includes('cinema') || category.includes('theater') || category.includes('entertainment')) {
          if (hour >= 18 && hour <= 22) {
            timeFitScore = 1;
          } else if (hour >= 14 && hour <= 17) {
            timeFitScore = 0.7;
          }
        }
        // Parks/Outdoor: High during day
        else if (category.includes('park') || category.includes('garden')) {
          if (hour >= 10 && hour <= 18) {
            timeFitScore = 1;
          } else {
            timeFitScore = 0.5;
          }
        }

        scoreBreakdown.time_fit = Math.round(timeFitScore * 20);
      }

      // 3. Weather Match (15 points)
      if (weather) {
        const category = activity.category.toLowerCase();
        const isOutdoor = category.includes('park') || category.includes('garden') || 
                         category.includes('sport') || category.includes('outdoor');
        const isIndoor = !isOutdoor;

        if (isOutdoor) {
          scoreBreakdown.weather = weather.isRaining ? 5 : 15;
        } else if (isIndoor) {
          scoreBreakdown.weather = weather.isRaining ? 15 : 10;
        } else {
          scoreBreakdown.weather = 10;
        }
      } else {
        scoreBreakdown.weather = 10; // neutral if no weather data
      }

      // 4. Budget Fit (15 points)
      const priceLevel = activity.price_level || 1;
      const userBudgetMax = profile.budget_max || 50;
      const allBudgets = [userBudgetMax, ...friendProfiles.map(f => f.budget_max || 50)];
      const lowestBudget = Math.min(...allBudgets);

      // Price level scale: 1=£10, 2=£25, 3=£50, 4=£100
      const estimatedPrice = priceLevel * 25;
      if (estimatedPrice <= lowestBudget) {
        scoreBreakdown.budget = 15;
      } else if (estimatedPrice <= lowestBudget * 1.2) {
        scoreBreakdown.budget = 10;
      } else {
        scoreBreakdown.budget = 5;
      }

      // 5. Proximity (10 points) - closer to midpoint = higher score
      const distance = activity.distance || 0;
      if (distance <= 1) {
        scoreBreakdown.proximity = 10;
      } else if (distance <= 2) {
        scoreBreakdown.proximity = 8;
      } else if (distance <= 3) {
        scoreBreakdown.proximity = 6;
      } else if (distance <= 4) {
        scoreBreakdown.proximity = 4;
      } else {
        scoreBreakdown.proximity = 2;
      }

      // 6. Duration Fit (10 points)
      if (freeBlock) {
        const blockDuration = freeBlock.duration;
        const travelTime = (distance || 0) * 10; // 10 min per km
        const activityDuration = 90; // assume 90 min average activity
        const totalNeeded = travelTime + activityDuration;

        if (totalNeeded <= blockDuration * 0.8) {
          scoreBreakdown.duration = 10;
        } else if (totalNeeded <= blockDuration) {
          scoreBreakdown.duration = 7;
        } else {
          scoreBreakdown.duration = 3;
        }
      } else {
        scoreBreakdown.duration = 7; // neutral
      }

      const totalScore = Object.values(scoreBreakdown).reduce((a: any, b: any) => a + b, 0);

      return {
        ...activity,
        totalScore,
        score_breakdown: scoreBreakdown,
      };
    });

    // Filter activities scoring < 50
    const filteredActivities = scoredActivities.filter((a: any) => a.totalScore >= 50);

    // Sort by score and take top 1 (best match for this time slot)
    const topActivity = filteredActivities
      .sort((a: any, b: any) => b.totalScore - a.totalScore)
      .slice(0, 1);

    console.log(`Filtered ${filteredActivities.length} activities scoring >= 50, selected top 1`);

    // If we have activities, enhance with Perplexity AI
    let enhancedActivities = topActivity;
    if (topActivity.length > 0) {
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke(
          'enhance-recommendations-ai',
          {
            body: {
              activities: topActivity.map((a: any) => ({
                id: a.id,
                name: a.name,
                category: a.category,
                totalScore: a.totalScore,
                address: a.address,
                price_level: a.price_level,
              })),
              timeSlot: freeBlock ? {
                start: freeBlock.start,
                end: freeBlock.end,
              } : {
                start: new Date().toISOString(),
                end: new Date(Date.now() + 3600000).toISOString(),
              },
              weather: weather || { temp: 15, isRaining: false },
              budget: {
                min: profile.budget_min || 0,
                max: profile.budget_max || 50,
              },
            },
          }
        );

        if (aiError) {
          console.error('AI enhancement error:', aiError);
        } else if (aiData?.activities) {
          enhancedActivities = topActivity.map((activity: any) => {
            const enhanced = aiData.activities.find((a: any) => a.id === activity.id);
            return enhanced || activity;
          });
        }
      } catch (aiError) {
        console.error('Failed to enhance with AI:', aiError);
      }
    }

    return new Response(
      JSON.stringify({ 
        recommendations: enhancedActivities,
        total_filtered: filteredActivities.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
