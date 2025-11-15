import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activity, userContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build user context string
    const contextParts = [];
    if (userContext?.preferences) {
      contextParts.push(`interests in ${userContext.preferences.join(', ')}`);
    }
    if (userContext?.location) {
      contextParts.push(`located near ${userContext.location}`);
    }
    if (userContext?.timeSlot) {
      contextParts.push(`free time on ${userContext.timeSlot}`);
    }

    const userContextStr = contextParts.length > 0 
      ? contextParts.join(', ') 
      : 'your preferences and schedule';

    const prompt = `Generate a brief, friendly 1-2 sentence explanation of why this event would be a great match for someone with ${userContextStr}.

Event: ${activity.name}
Category: ${activity.category}
${activity.description ? `Description: ${activity.description}` : ''}
${activity.location ? `Location: ${activity.location}` : ''}
${activity.date ? `Date: ${activity.date}` : ''}

Keep it personal, enthusiastic, and concise. Focus on why this specific event aligns with their interests and situation.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: 'You are a friendly event recommendation assistant. Explain why events match users in a warm, concise way.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI usage limit reached. Please check your Lovable AI credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ explanation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in explain-recommendation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
