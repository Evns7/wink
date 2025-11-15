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
  radius: z.number().optional().default(5),
  preferences: z.array(z.string()).optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  timeOfDay: z.string().optional(),
  date: z.string().optional(),
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

    const { lat, lng, radius, preferences, budgetMin, budgetMax, timeOfDay, date } = validationResult.data;
    
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const userPreferences = preferences || [];
    const budget = budgetMax || profile?.budget_max || 50;
    const currentDate = date || new Date().toISOString().split('T')[0];
    const currentTime = timeOfDay || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Enhanced system prompt for Perplexity
    const systemPrompt = `You are an expert local activities curator. Your role is to find and recommend real, publicly accessible activities near a specific location.

CRITICAL RULES:
1. Only include activities with a proper name, type, and exact location
2. Never hallucinate or make up information
3. Exclude hotels, accommodations, and generic "unknown" activities
4. All activities must be publicly searchable and have real addresses
5. Provide accurate coordinates for each activity
6. Calculate realistic match scores (0-100%) based on user preferences and context
7. Include working thumbnail images from reliable sources
8. Be critical with scoring - not everything should be 90-100%

SCORING BREAKDOWN (must total 0-100%):
- Preference match (0-30%): How well it matches user's stated interests
- Time fit (0-20%): Appropriateness for the time of day
- Weather appropriateness (0-15%): Indoor/outdoor suitability
- Budget fit (0-15%): Within budget and good value
- Proximity (0-10%): Distance from user location
- Duration fit (0-10%): Fits typical visit duration

Return ONLY valid, verified activities with complete information.`;

    const userPrompt = `Find 10 real activities near coordinates ${lat}, ${lng} (within ${radius}km radius).

Context:
- Date: ${currentDate}
- Time: ${currentTime}
- Budget: £0-£${budget}
- User preferences: ${userPreferences.length > 0 ? userPreferences.join(', ') : 'varied activities'}
- User location: ${lat}, ${lng}

For each activity, provide:
1. Exact name and type/category
2. Precise coordinates (latitude, longitude)
3. Full address
4. Operating hours or typical duration
5. Price range (if applicable)
6. Distance from user (in km)
7. Estimated travel time by public transport
8. Realistic match percentage (0-100%) with breakdown of scoring factors
9. Brief description (1-2 sentences)
10. Public thumbnail image URL
11. Why this activity matches the user's context

Focus on:
- Museums, galleries, parks, attractions, entertainment venues
- Active experiences (sports, activities, outdoor)
- Cultural venues (theatres, cinemas, concert halls)
- Unique local experiences
- Actually OPEN at the specified time

Exclude:
- Hotels and accommodations
- Generic or unnamed locations
- Activities that are closed at this time
- Anything without a verifiable address

Be realistic with match scores - consider time, weather, budget, and distance.`;

    console.log('Calling Perplexity API for activity generation...');

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'activity_recommendations',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                activities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Activity name' },
                      category: { type: 'string', description: 'Activity category/type' },
                      latitude: { type: 'number', description: 'Latitude coordinate' },
                      longitude: { type: 'number', description: 'Longitude coordinate' },
                      address: { type: 'string', description: 'Full street address' },
                      description: { type: 'string', description: 'Brief description' },
                      start_time: { type: 'string', description: 'Opening time or start time' },
                      end_time: { type: 'string', description: 'Closing time or end time' },
                      duration_hours: { type: 'number', description: 'Typical visit duration in hours' },
                      price_level: { type: 'number', description: 'Price in GBP (0 for free)' },
                      distance_km: { type: 'number', description: 'Distance from user in km' },
                      travel_time_minutes: { type: 'number', description: 'Travel time by public transport' },
                      match_percentage: { type: 'number', description: 'Overall match 0-100', minimum: 0, maximum: 100 },
                      preference_score: { type: 'number', description: 'Preference match 0-30', minimum: 0, maximum: 30 },
                      time_fit_score: { type: 'number', description: 'Time appropriateness 0-20', minimum: 0, maximum: 20 },
                      weather_score: { type: 'number', description: 'Weather suitability 0-15', minimum: 0, maximum: 15 },
                      budget_score: { type: 'number', description: 'Budget fit 0-15', minimum: 0, maximum: 15 },
                      proximity_score: { type: 'number', description: 'Distance score 0-10', minimum: 0, maximum: 10 },
                      duration_score: { type: 'number', description: 'Duration fit 0-10', minimum: 0, maximum: 10 },
                      reasoning: { type: 'string', description: 'Why this activity matches' },
                      thumbnail_url: { type: 'string', description: 'Public image URL' },
                    },
                    required: [
                      'name', 'category', 'latitude', 'longitude', 'address',
                      'description', 'match_percentage', 'distance_km',
                      'travel_time_minutes', 'reasoning', 'thumbnail_url'
                    ],
                    additionalProperties: false
                  }
                }
              },
              required: ['activities'],
              additionalProperties: false
            }
          }
        },
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate activities', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    console.log('Perplexity response:', JSON.stringify(perplexityData, null, 2));

    const content = perplexityData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', content);
      throw new Error('Invalid JSON response from AI');
    }

    const activities = parsedResponse.activities || [];

    // Generate Google Maps links for each activity
    const activitiesWithMaps = activities.map((activity: any) => {
      const encodedName = encodeURIComponent(activity.name);
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedName}+${activity.latitude},${activity.longitude}`;
      
      return {
        ...activity,
        google_maps_link: mapsLink,
        // Ensure all required fields are present
        id: `perplexity-${activity.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        price_level: activity.price_level || 0,
        start_time: activity.start_time || '09:00',
        end_time: activity.end_time || '18:00',
        duration_hours: activity.duration_hours || 2,
      };
    });

    // Sort by match percentage descending
    activitiesWithMaps.sort((a: any, b: any) => b.match_percentage - a.match_percentage);

    console.log(`Generated ${activitiesWithMaps.length} activities with maps links`);

    return new Response(
      JSON.stringify({ 
        activities: activitiesWithMaps,
        count: activitiesWithMaps.length,
        location: { lat, lng },
        radius,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-activities-perplexity:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
