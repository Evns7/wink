import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const scrapeSchema = z.object({
  location: z.string(),
  radius: z.number().optional(),
  categories: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const rawData = await req.json();
    const validationResult = scrapeSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { location, radius = 25, categories, startDate, endDate } = validationResult.data;
    
    console.log('Scraping events for:', { location, radius, categories });

    const categoryText = categories && categories.length > 0 
      ? `focusing on ${categories.join(', ')} events`
      : 'across all categories';
    
    const dateText = startDate 
      ? `from ${startDate} to ${endDate || 'the next 30 days'}`
      : 'in the next 2 weeks';

    const query = `Find real upcoming events on Eventbrite and similar event platforms in ${location} within ${radius}km ${dateText}, ${categoryText}. 
    
For each event, provide:
- title (event name)
- description (brief summary)
- category (e.g., music, sports, food, arts, networking)
- location (venue name and address)
- date (ISO format)
- time (start time)
- price (free, price range, or specific amount)
- url (direct link to event)
- popularity (estimate based on available data: high/medium/low)

Return ONLY valid JSON array with 10-15 real events. No markdown, no explanations.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a precise web scraper that returns only valid JSON arrays of event data from Eventbrite and similar platforms. Never add markdown formatting or explanations.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from Perplexity');
    }

    console.log('Raw Perplexity response:', content);

    let events = [];
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, content];
      const jsonText = jsonMatch[1] || content;
      events = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Content that failed to parse:', content);
      throw new Error('Failed to parse events data from LLM response');
    }

    const normalizedEvents = events.map((event: any) => {
      let priceLevel = 1;
      let priceRange = 'Free';
      
      if (event.price) {
        const priceStr = event.price.toString().toLowerCase();
        if (priceStr.includes('free') || priceStr === '0') {
          priceLevel = 0;
          priceRange = 'Free';
        } else if (priceStr.includes('$')) {
          const matches = priceStr.match(/\$(\d+)/g);
          if (matches && matches.length > 0) {
            const prices = matches.map((m: string) => parseInt(m.replace('$', '')));
            const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            priceLevel = avgPrice <= 10 ? 1 : avgPrice <= 30 ? 2 : avgPrice <= 60 ? 3 : 4;
            priceRange = prices.length > 1 
              ? `$${Math.min(...prices)}-$${Math.max(...prices)}`
              : `$${prices[0]}`;
          }
        }
      }

      const popularity = event.popularity?.toLowerCase() || 'medium';
      const popularityScore = popularity === 'high' ? 1.0 : popularity === 'medium' ? 0.7 : 0.4;

      return {
        title: event.title || 'Untitled Event',
        description: event.description || 'No description available',
        category: event.category || 'general',
        location: event.location || location,
        date: event.date || new Date().toISOString(),
        time: event.time || '12:00',
        price: event.price || 'Free',
        priceLevel,
        priceRange,
        url: event.url || '',
        popularity,
        popularityScore,
        source: 'live_scrape'
      };
    });

    console.log(`Successfully scraped ${normalizedEvents.length} events`);

    return new Response(
      JSON.stringify({ 
        success: true,
        events: normalizedEvents,
        count: normalizedEvents.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
