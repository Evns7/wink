import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

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

    const { lat, lng, radius = 5 } = validationResult.data;

    // Get user profile and preferences
    const [profileResult, preferencesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('preferences').select('*').eq('user_id', user.id)
    ]);

    const profile = profileResult.data;
    const userPreferences = preferencesResult.data || [];
    const selectedHobbies = userPreferences
      .filter((p: any) => p.score === 10)
      .map((p: any) => p.category);

    console.log('Fetching nearby activities from Overpass API...');
    
    // Fetch from Overpass API
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["tourism"](around:${radius * 1000},${lat},${lng});
        node["leisure"](around:${radius * 1000},${lat},${lng});
        node["amenity"~"restaurant|cafe|bar|cinema|theatre"](around:${radius * 1000},${lat},${lng});
        node["shop"](around:${radius * 1000},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
    });

    if (!overpassResponse.ok) {
      throw new Error('Failed to fetch from Overpass API');
    }

    const overpassData = await overpassResponse.json();
    const activities = overpassData.elements || [];

    console.log(`Found ${activities.length} activities from Overpass`);

    // Process and score activities
    const scoredActivities = activities.slice(0, 20).map((activity: any) => {
      const name = activity.tags?.name || activity.tags?.amenity || 'Unknown Activity';
      const category = activity.tags?.tourism || activity.tags?.leisure || activity.tags?.amenity || activity.tags?.shop || 'general';
      
      // Calculate distance
      const actLat = activity.lat;
      const actLng = activity.lon;
      const R = 6371; // Earth's radius in km
      const dLat = (actLat - lat) * Math.PI / 180;
      const dLon = (actLng - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(actLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // Calculate travel time (assume 5 km/h walking speed)
      const travelTimeMinutes = Math.round((distance / 5) * 60);

      // Calculate match score (clamped to 100)
      const scoreBreakdown: any = {
        preference: 0,
        distance: 0,
        rating: 0,
      };

      // Preference matching (max 30)
      const categoryLower = category.toLowerCase();
      const matchingPrefs = selectedHobbies.filter((hobby: string) => 
        categoryLower.includes(hobby.toLowerCase()) || 
        hobby.toLowerCase().includes(categoryLower)
      );
      scoreBreakdown.preference = matchingPrefs.length > 0 ? 30 : 10;

      // Distance scoring (max 40)
      if (distance <= 1) {
        scoreBreakdown.distance = 40;
      } else if (distance <= 2) {
        scoreBreakdown.distance = 30;
      } else if (distance <= 3) {
        scoreBreakdown.distance = 20;
      } else {
        scoreBreakdown.distance = 10;
      }

      // Rating/popularity (max 30)
      const rating = parseFloat(activity.tags?.rating || '3');
      scoreBreakdown.rating = Math.round((rating / 5) * 30);

      const totalScore = scoreBreakdown.preference + scoreBreakdown.distance + scoreBreakdown.rating;
      const matchScore = Math.min(totalScore, 100);

      return {
        id: activity.id.toString(),
        name,
        description: activity.tags?.description || `${category} activity`,
        category,
        location: activity.tags?.['addr:full'] || `${actLat.toFixed(4)}, ${actLng.toFixed(4)}`,
        lat: actLat,
        lng: actLng,
        distance: parseFloat(distance.toFixed(2)),
        travelTime: travelTimeMinutes,
        price: activity.tags?.fee || activity.tags?.charge || 'Free',
        priceLevel: activity.tags?.fee ? 2 : 0,
        rating: rating,
        matchScore,
        matchFactors: scoreBreakdown,
        imageUrl: null, // Will be enriched with Perplexity if available
        source: 'overpass',
      };
    });

    // Filter activities with reasonable match scores
    const filteredActivities = scoredActivities.filter((a: any) => a.matchScore >= 30);
    const topActivities = filteredActivities
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 15);

    // Enrich with images if Perplexity is available
    if (perplexityApiKey && topActivities.length > 0) {
      console.log('Enriching activities with images via Perplexity...');
      
      const enrichmentPromises = topActivities.slice(0, 5).map(async (activity: any) => {
        try {
          const query = `Find a high-quality image URL for: ${activity.name}, ${activity.category} in ${activity.location}. Return ONLY a valid image URL, nothing else.`;
          
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful assistant that finds image URLs. Return ONLY the URL, no explanations.'
                },
                {
                  role: 'user',
                  content: query
                }
              ],
              temperature: 0.2,
              max_tokens: 200,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const imageUrl = data.choices?.[0]?.message?.content?.trim();
            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              activity.imageUrl = imageUrl;
            }
          }
        } catch (error) {
          console.error(`Error enriching ${activity.name}:`, error);
        }
      });

      await Promise.all(enrichmentPromises);
    }

    console.log(`Returning ${topActivities.length} nearby activities`);

    return new Response(
      JSON.stringify({ 
        activities: topActivities,
        totalFound: activities.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Nearby activities error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
