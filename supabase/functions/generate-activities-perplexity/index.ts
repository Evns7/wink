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

    // Enhanced system prompt for Perplexity - EXPERIENTIAL FOCUS
    const systemPrompt = `You are an expert London event curator and insider guide, specializing in unique, memorable, and fun experiences for couples and friends.

Your role is to discover and recommend distinctive, exciting activities that create lasting memories - NOT boring tourist traps or routine places.

CRITICAL FOCUS AREAS (Prioritize 3-4):
1. Temporary Events: Pop-up bars, seasonal markets, limited-run festivals, unique one-day happenings, art installations
2. Immersive Experiences: Escape rooms, interactive art, themed dining, unconventional tours, secret cinema
3. Hidden Gems: Cool independent venues (speakeasy bars, unique microbreweries, niche food halls, rooftop spaces)
4. Cultural/Exhibitions: Temporary art exhibitions, photogenic museum installations, interactive galleries

STRICT EXCLUSIONS - NEVER SUGGEST:
❌ Chain supermarkets, banks, basic high-street restaurants
❌ Standard tourist traps (Big Ben, London Eye unless there's something unique)
❌ Generic parks without special events
❌ Hotels or accommodations
❌ Routine, functional, or purely convenience locations
❌ Anything boring or predictable

REQUIRED QUALITIES:
✅ Unique and memorable experiences
✅ Instagram-worthy or conversation-starter venues
✅ Activities that spark excitement and curiosity
✅ Places locals actually recommend to friends
✅ Novel, experiential, and engaging
✅ Real locations with exact addresses and coordinates

TONE: Enthusiastic, inspiring, makes people want to go immediately

SCORING (0-100%, be critical and ACCURATE):
CRITICAL RULE: The sum of the 5 component scores below MUST equal exactly 0-100. This is mandatory.

Component Scores (MUST sum to 0-100):
- uniqueness_score (0-35): How special and memorable the experience is
- preference_score (0-25): How well it matches user's stated interests
- time_fit_score (0-20): How perfect it is for this time/date/atmosphere
- budget_score (0-10): Value for money within user's budget
- proximity_score (0-10): How convenient the location is

Example calculation:
If uniqueness_score=28, preference_score=20, time_fit_score=15, budget_score=8, proximity_score=7
Then match_percentage = 28+20+15+8+7 = 78

VERIFY: Always check that uniqueness + preference + time_fit + budget + proximity = match_percentage (0-100)

Focus on EXPERIENCES over places. Make every suggestion exciting.`;

    const userPrompt = `Curate 10 EXCEPTIONAL and UNIQUE experiences in London near ${lat}, ${lng} (within ${radius}km).

🎯 Context:
- **User Location**: ${lat}, ${lng} (THIS IS CRITICAL - all distances and travel times must be calculated from HERE)
- Date: ${currentDate} | Time: ${currentTime}
- Budget: £0-£${budget}
- Seeking: ${userPreferences.length > 0 ? userPreferences.join(', ') : 'exciting, memorable experiences'}
- Looking for: Activities that friends and couples will talk about for weeks

🌟 PRIORITY - Find activities like:
- Pop-up bars, secret speakeasies, rooftop venues with a twist
- Immersive dining (theatrical restaurants, themed experiences, chef's tables)
- Interactive art installations, temporary exhibitions, photogenic galleries
- Unique escape rooms, VR experiences, interactive theatre
- Seasonal markets with a unique angle, food festivals, night markets
- Hidden gems: indie breweries, quirky cocktail bars, unusual food halls
- Special events: live music in unusual venues, comedy in unique spaces
- Unconventional tours: street art walks, food tours, secret history tours

Each activity MUST have:
1. **Catchy Title**: Make it sound irresistible (e.g., "Moonlit Rooftop Cocktails at Secret Garden Bar")
2. **Experience Description**: 2-3 sentences that sell the experience, not just describe the place
3. **Category**: Type of experience (e.g., "Hidden Bar", "Immersive Dining", "Pop-Up Event")
4. **Area**: General location (Shoreditch, Covent Garden, South Bank, etc.)
5. **Exact coordinates** and **full address**
6. **What makes it special**: The unique selling point
7. **Vibe**: The atmosphere (e.g., "Instagram heaven", "Date night magic", "Friend group energy")
8. **Time details**: When it's open/happening
9. **💰 PRICE (CRITICAL)**: Exact price in £ - be specific (e.g., £15 entry, £35 dinner, £0 for free events)
10. **📍 DISTANCE (CRITICAL)**: Precise distance in km from coordinates ${lat}, ${lng} - calculate accurately
11. **⏱️ TRAVEL TIME (CRITICAL)**: Realistic travel time in minutes by public transport from ${lat}, ${lng} - be accurate
12. **Component Scores (MANDATORY - must sum exactly to match_percentage 0-100)**:
   - uniqueness_score (0-35): How special/memorable the experience is
   - preference_score (0-25): How well it matches stated preferences
   - time_fit_score (0-20): How well it fits the time/date/atmosphere
   - budget_score (0-10): Value for money within budget
   - proximity_score (0-10): How convenient the location is
13. **match_percentage (0-100)**: MUST equal the exact sum of the 5 component scores above
   
   CRITICAL: Verify math before outputting each activity:
   match_percentage = uniqueness_score + preference_score + time_fit_score + budget_score + proximity_score

❌ ABSOLUTELY DO NOT INCLUDE:
- Generic chain restaurants or cafes
- Standard museums without special exhibitions
- Basic parks (unless there's an event)
- Tourist clichés without a unique angle
- Anything boring, corporate, or routine
- Hotels or accommodation
- Activities with vague or unknown pricing
- Activities without accurate location data

✅ MAKE IT EXCITING:
- Use enthusiastic, inspiring language
- Focus on the EXPERIENCE, not just the place
- Highlight what makes it Instagram-worthy or memorable
- Be specific about WHY it's cool
- Real London insider knowledge
- **ACCURATE pricing in £** - users need to budget
- **PRECISE distances and travel times** - users need to plan their journey

Current real-time context: ${currentDate} at ${currentTime} - suggest things actually happening NOW or soon.

⚠️ CRITICAL REQUIREMENTS:
- Price MUST be in £ (British Pounds), not generic price levels
- Distance MUST be calculated from coordinates ${lat}, ${lng}
- Travel time MUST be realistic by London public transport (Tube, bus, etc.)
- All three fields (price, distance, travel_time) are MANDATORY for each activity

Remember: We want activities that make people say "Oh wow, I didn't know that existed!" not "Yeah, that's just a normal [place]".`;

    console.log('Calling Perplexity API for activity generation...');

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
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
                      name: { type: 'string', description: 'Catchy, irresistible title' },
                      category: { type: 'string', description: 'Type of experience' },
                      area: { type: 'string', description: 'General London area (e.g., Shoreditch)' },
                      latitude: { type: 'number', description: 'Latitude coordinate' },
                      longitude: { type: 'number', description: 'Longitude coordinate' },
                      address: { type: 'string', description: 'Full street address' },
                      description: { type: 'string', description: '2-3 sentences selling the experience' },
                      what_makes_it_special: { type: 'string', description: 'Unique selling point' },
                      vibe: { type: 'string', description: 'Atmosphere (e.g., "Date night magic")' },
                      start_time: { type: 'string', description: 'Opening time or start time' },
                      end_time: { type: 'string', description: 'Closing time or end time' },
                      duration_hours: { type: 'number', description: 'Typical visit duration in hours' },
                      price_level: { type: 'number', description: 'Price in GBP (0 for free)' },
                      distance_km: { type: 'number', description: 'Distance from user in km' },
                      travel_time_minutes: { type: 'number', description: 'Travel time by public transport' },
                      uniqueness_score: { type: 'number', description: 'How unique/special (0-35)', minimum: 0, maximum: 35 },
                      preference_score: { type: 'number', description: 'User preference match (0-25)', minimum: 0, maximum: 25 },
                      time_fit_score: { type: 'number', description: 'Time & atmosphere fit (0-20)', minimum: 0, maximum: 20 },
                      budget_score: { type: 'number', description: 'Budget & value (0-10)', minimum: 0, maximum: 10 },
                      proximity_score: { type: 'number', description: 'Distance convenience (0-10)', minimum: 0, maximum: 10 },
                      match_percentage: { type: 'number', description: 'MUST equal sum of all 5 component scores (0-100)', minimum: 0, maximum: 100 },
                      reasoning: { type: 'string', description: 'Why this is exciting and matches user' },
                    },
                    required: [
                      'name', 'category', 'area', 'latitude', 'longitude', 'address',
                      'description', 'what_makes_it_special', 'vibe', 
                      'uniqueness_score', 'preference_score', 'time_fit_score', 'budget_score', 'proximity_score',
                      'match_percentage', 'distance_km', 'travel_time_minutes', 'reasoning'
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
        max_tokens: 3000,
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

    // Validate and normalize scores for each activity
    const activitiesWithMaps = activities.map((activity: any) => {
      // Calculate match_percentage from component scores (must sum to 0-100)
      const componentSum = 
        (activity.uniqueness_score || 0) +
        (activity.preference_score || 0) +
        (activity.time_fit_score || 0) +
        (activity.budget_score || 0) +
        (activity.proximity_score || 0);
      
      // Verify Perplexity's match_percentage matches the component sum
      let match_percentage = activity.match_percentage || componentSum;
      
      // If there's a mismatch, recalculate from components (they're the source of truth)
      if (Math.abs(match_percentage - componentSum) > 1) {
        console.warn(`Match percentage mismatch for ${activity.name}: stated ${match_percentage} vs calculated ${componentSum}, using calculated`);
        match_percentage = componentSum;
      }
      
      // Ensure final score is 0-100
      match_percentage = Math.min(100, Math.max(0, match_percentage));
      
      const encodedName = encodeURIComponent(activity.name);
      
      // Generate proper Google Maps link with fallback for missing coordinates
      let mapsLink;
      if (activity.latitude && activity.longitude && 
          !isNaN(activity.latitude) && !isNaN(activity.longitude)) {
        // Full link with coordinates
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedName}+${activity.latitude},${activity.longitude}`;
      } else {
        // Fallback to name-only search if coordinates are missing or invalid
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
      }
      
      return {
        ...activity,
        match_percentage: Math.round(match_percentage),
        google_maps_link: mapsLink,
        // Ensure all required fields are present
        id: `perplexity-${activity.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        price_level: activity.price_level || 0,
        start_time: activity.start_time || '09:00',
        end_time: activity.end_time || '18:00',
        duration_hours: activity.duration_hours || 2,
        area: activity.area || 'Central London',
        what_makes_it_special: activity.what_makes_it_special || activity.reasoning,
        vibe: activity.vibe || 'Exciting experience',
        // Ensure component scores are within bounds
        uniqueness_score: Math.min(35, Math.max(0, activity.uniqueness_score || 0)),
        preference_score: Math.min(25, Math.max(0, activity.preference_score || 0)),
        time_fit_score: Math.min(20, Math.max(0, activity.time_fit_score || 0)),
        budget_score: Math.min(10, Math.max(0, activity.budget_score || 0)),
        proximity_score: Math.min(10, Math.max(0, activity.proximity_score || 0)),
        // Ensure coordinates are valid numbers or undefined
        latitude: activity.latitude && !isNaN(activity.latitude) ? activity.latitude : undefined,
        longitude: activity.longitude && !isNaN(activity.longitude) ? activity.longitude : undefined,
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
