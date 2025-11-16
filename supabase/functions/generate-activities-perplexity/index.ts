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

    // SPEED-OPTIMIZED system prompt - minimal data, fast retrieval
    const systemPrompt = `You are a fast London activity curator. Return ONLY essential data in compact format.

SPEED RULES:
- Keep responses SHORT and STRUCTURED
- NO long descriptions or paragraphs
- Return ONLY 15 activities maximum
- Use shallow data - no deep scraping
- Skip activities with missing coordinates or prices

CATEGORY BALANCE - Include roughly equal amounts from each:
1. Bars/Pubs (2-3 activities)
2. Restaurants/Dining (2-3 activities)
3. Museums (2-3 activities)
4. Art Galleries (2-3 activities)
5. Outdoor Activities/Parks (2-3 activities)

EXCLUDE: Hotels, chains, tourist traps, unknowns, live events, concerts, shows, ticketed time-sensitive events

SCORING (fast formula, 0-100):
- uniqueness_score (0-35): How special
- preference_score (0-25): User interest match
- time_fit_score (0-20): Time/atmosphere fit
- budget_score (0-10): Price fit
- proximity_score (0-10): Distance convenience
Total MUST = match_percentage (0-100)`;

    const userPrompt = `Find 15 diverse London activities near ${lat}, ${lng} (${radius}km radius).

Context:
- Location: ${lat}, ${lng} (calculate ALL distances from here)
- Time: ${currentDate}, ${currentTime}
- Budget: £${budget} max
- Interests: ${userPreferences.length > 0 ? userPreferences.join(', ') : 'diverse experiences'}

BALANCE REQUIREMENT: Include 2-3 from EACH category:
- Bars/Pubs (cocktail bars, craft beer, wine bars, pubs)
- Restaurants (fine dining, casual, cuisines, pop-ups)
- Museums (art, history, science, niche museums)
- Art Galleries (contemporary, classic, exhibitions)
- Outdoor Activities (parks, gardens, outdoor markets, walking tours, viewpoints)

EXCLUDE: Live concerts, shows, ticketed events, time-sensitive events. Focus ONLY on regular venues and always-available activities.

Requirements per activity:
- Name (short, catchy)
- Category
- Area
- Exact coordinates + address
- Price in £ (specific number)
- Distance in km from ${lat}, ${lng}
- Travel time in minutes (public transport from ${lat}, ${lng})
- Brief vibe (1 sentence max)
- What makes it special (1 sentence)
- Component scores:
  * uniqueness_score (0-35)
  * preference_score (0-25)
  * time_fit_score (0-20)
  * budget_score (0-10)
  * proximity_score (0-10)
  * match_percentage = sum of above (0-100)

EXCLUDE: Hotels, chains, tourist traps, generic parks, anything without coordinates/price

Keep it COMPACT and FAST. No long descriptions.`;

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

    // Validate and normalize scores - minimal processing
    const activitiesWithMaps = activities.map((activity: any) => {
      // Calculate match_percentage from component scores
      const componentSum = 
        (activity.uniqueness_score || 0) +
        (activity.preference_score || 0) +
        (activity.time_fit_score || 0) +
        (activity.budget_score || 0) +
        (activity.proximity_score || 0);
      
      let match_percentage = activity.match_percentage || componentSum;
      
      // Recalculate if mismatch
      if (Math.abs(match_percentage - componentSum) > 1) {
        match_percentage = componentSum;
      }
      
      // Clamp to 0-100
      match_percentage = Math.min(100, Math.max(0, match_percentage));
      
      const encodedName = encodeURIComponent(activity.name);
      
      // Generate Google Maps link
      let mapsLink;
      if (activity.latitude && activity.longitude && 
          !isNaN(activity.latitude) && !isNaN(activity.longitude)) {
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedName},${activity.latitude},${activity.longitude}`;
      } else {
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
      }
      
      return {
        id: `perplexity-${activity.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: activity.name,
        category: activity.category,
        area: activity.area,
        address: activity.address,
        latitude: activity.latitude,
        longitude: activity.longitude,
        vibe: activity.vibe,
        what_makes_it_special: activity.what_makes_it_special,
        price_level: activity.price_level || 0,
        distance_km: activity.distance_km,
        travel_time_minutes: activity.travel_time_minutes,
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
