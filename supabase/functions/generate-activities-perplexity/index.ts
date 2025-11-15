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

    // ULTRA-FAST system prompt - minimal processing, essential data only
    const systemPrompt = `Fast London activity curator. Essential data only. Max 10 results.

INCLUDE: Pop-ups, hidden bars, art, immersive dining, escape rooms, rooftop venues, markets
EXCLUDE: Hotels, chains, tourist traps, parks, unknowns, anything without coordinates/price

SCORING (0-100 total):
uniqueness(0-35) + preference(0-25) + time(0-20) + budget(0-10) + proximity(0-10) = match_percentage

Fast shallow search only. No deep scraping. No long text. Structured output only.`;

    const userPrompt = `10 unique London activities near ${lat},${lng} (${radius}km). Fast search only.

Time: ${currentDate} ${currentTime} | Budget: £${budget} | Interests: ${userPreferences.length > 0 ? userPreferences.join(', ') : 'unique'}

Per activity provide:
- name (short)
- category
- area
- latitude, longitude, address
- price_level (£ number)
- distance_km (from ${lat},${lng})
- travel_time_minutes (public transport from ${lat},${lng})
- vibe (1 line)
- what_makes_it_special (1 line)
- Scores: uniqueness(0-35) + preference(0-25) + time(0-20) + budget(0-10) + proximity(0-10) = match_percentage(0-100)

EXCLUDE: Hotels, chains, parks, tourist traps, missing data. Keep compact.`;

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
                      name: { type: 'string' },
                      category: { type: 'string' },
                      area: { type: 'string' },
                      latitude: { type: 'number' },
                      longitude: { type: 'number' },
                      address: { type: 'string' },
                      vibe: { type: 'string' },
                      price_level: { type: 'number' },
                      distance_km: { type: 'number' },
                      travel_time_minutes: { type: 'number' },
                      uniqueness_score: { type: 'number', minimum: 0, maximum: 35 },
                      preference_score: { type: 'number', minimum: 0, maximum: 25 },
                      time_fit_score: { type: 'number', minimum: 0, maximum: 20 },
                      budget_score: { type: 'number', minimum: 0, maximum: 10 },
                      proximity_score: { type: 'number', minimum: 0, maximum: 10 },
                      match_percentage: { type: 'number', minimum: 0, maximum: 100 },
                      what_makes_it_special: { type: 'string' },
                    },
                    required: [
                      'name', 'category', 'area', 'latitude', 'longitude', 'address',
                      'vibe', 'price_level', 'distance_km', 'travel_time_minutes',
                      'uniqueness_score', 'preference_score', 'time_fit_score', 
                      'budget_score', 'proximity_score', 'match_percentage',
                      'what_makes_it_special'
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
        temperature: 0.2,
        max_tokens: 2500,
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

    // Check if response was truncated
    if (perplexityData.choices?.[0]?.finish_reason === 'length') {
      console.warn('Response was truncated due to token limit');
    }

    const content = perplexityData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      console.error('Content length:', content.length);
      console.error('First 500 chars:', content.substring(0, 500));
      console.warn('Returning empty activities due to parse error');
      parsedResponse = { activities: [] };
    }

    const activities = parsedResponse.activities || [];

    // Fast normalization - minimal processing
    const activitiesWithMaps = activities.map((activity: any) => {
      // Quick score validation
      const componentSum = 
        (activity.uniqueness_score || 0) +
        (activity.preference_score || 0) +
        (activity.time_fit_score || 0) +
        (activity.budget_score || 0) +
        (activity.proximity_score || 0);
      
      const match_percentage = Math.min(100, Math.max(0, componentSum));
      const encodedName = encodeURIComponent(activity.name || 'activity');
      
      // Fast Google Maps link generation
      const hasCoords = activity.latitude && activity.longitude && 
                        !isNaN(activity.latitude) && !isNaN(activity.longitude);
      const mapsLink = hasCoords 
        ? `https://www.google.com/maps/search/?api=1&query=${encodedName},${activity.latitude},${activity.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
      
      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: activity.name,
        category: activity.category,
        area: activity.area || 'London',
        address: activity.address || '',
        latitude: hasCoords ? activity.latitude : null,
        longitude: hasCoords ? activity.longitude : null,
        vibe: activity.vibe || '',
        what_makes_it_special: activity.what_makes_it_special || '',
        price_level: activity.price_level || 0,
        distance_km: activity.distance_km || 0,
        travel_time_minutes: activity.travel_time_minutes || 0,
        uniqueness_score: Math.min(35, Math.max(0, activity.uniqueness_score || 0)),
        preference_score: Math.min(25, Math.max(0, activity.preference_score || 0)),
        time_fit_score: Math.min(20, Math.max(0, activity.time_fit_score || 0)),
        budget_score: Math.min(10, Math.max(0, activity.budget_score || 0)),
        proximity_score: Math.min(10, Math.max(0, activity.proximity_score || 0)),
        match_percentage: Math.round(match_percentage),
        google_maps_link: mapsLink,
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
