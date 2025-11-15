import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const enhanceSchema = z.object({
  activities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    totalScore: z.number(),
    address: z.string().optional(),
    price_level: z.number().optional(),
  })).max(5),
  timeSlot: z.object({
    start: z.string(),
    end: z.string(),
  }),
  weather: z.object({
    temp: z.number(),
    isRaining: z.boolean(),
  }),
  budget: z.object({
    min: z.number(),
    max: z.number(),
  }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawData = await req.json();
    const validationResult = enhanceSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { activities, timeSlot, weather, budget } = validationResult.data;
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      console.warn('PERPLEXITY_API_KEY not configured, returning activities without AI enhancement');
      return new Response(
        JSON.stringify({ 
          activities: activities.map(a => ({ 
            ...a, 
            ai_reasoning: null,
            insider_tip: null 
          })) 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Given these 5 activities in London for ${new Date(timeSlot.start).toLocaleDateString()} from ${new Date(timeSlot.start).toLocaleTimeString()} to ${new Date(timeSlot.end).toLocaleTimeString()}:

Weather: ${weather.temp}°C, ${weather.isRaining ? 'Rainy' : 'Clear'}
Budget: £${budget.min}-£${budget.max}

Activities:
${activities.map((a, i) => `${i + 1}. ${a.name} (${a.category}) - Score: ${a.totalScore}/100`).join('\n')}

For EACH activity, provide:
1. A compelling one-sentence reason to go (max 30 words)
2. Any current deals, special events, or insider tips happening at this location

Return ONLY valid JSON in this exact format:
[
  {
    "activity_name": "exact name from list",
    "reason": "one compelling sentence",
    "insider_tip": "deal/event/tip or empty string if none"
  }
]`;

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You provide compelling activity recommendations with real-time insights. Always return valid JSON only, no markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!perplexityResponse.ok) {
      console.error('Perplexity API error:', await perplexityResponse.text());
      return new Response(
        JSON.stringify({ 
          activities: activities.map(a => ({ 
            ...a, 
            ai_reasoning: null,
            insider_tip: null 
          })) 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    // Parse JSON response (handle markdown code blocks if present)
    let enhancements: any[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      enhancements = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', content);
      return new Response(
        JSON.stringify({ 
          activities: activities.map(a => ({ 
            ...a, 
            ai_reasoning: null,
            insider_tip: null 
          })) 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Merge AI enhancements back into activities
    const enhancedActivities = activities.map(activity => {
      const enhancement = enhancements.find(e => 
        e.activity_name?.toLowerCase().includes(activity.name.toLowerCase()) ||
        activity.name.toLowerCase().includes(e.activity_name?.toLowerCase())
      );

      return {
        ...activity,
        ai_reasoning: enhancement?.reason || null,
        insider_tip: enhancement?.insider_tip || null,
      };
    });

    console.log('Enhanced activities:', enhancedActivities);

    return new Response(
      JSON.stringify({ activities: enhancedActivities }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enhancing recommendations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
