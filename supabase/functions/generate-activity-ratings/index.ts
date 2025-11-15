import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const { activities } = await req.json();

    if (!activities || activities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No activities provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Generate ratings for multiple activities
    const activitiesWithRatings = await Promise.all(
      activities.map(async (activity: any) => {
        try {
          const rating = await generateRating(activity);
          return { ...activity, rating };
        } catch (error) {
          console.error(`Error generating rating for ${activity.name}:`, error);
          // Return a default rating if generation fails
          return { ...activity, rating: 4.0 };
        }
      })
    );

    return new Response(
      JSON.stringify({ activities: activitiesWithRatings }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});

async function generateRating(activity: any): Promise<number> {
  if (!PERPLEXITY_API_KEY) {
    // Return a calculated rating based on category if no API key
    return calculateDefaultRating(activity);
  }

  const prompt = `Rate the following place on a scale of 1.0 to 5.0 based on typical user reviews and popularity. Only respond with a number between 1.0 and 5.0, nothing else.

Place: ${activity.name}
Category: ${activity.category}
Location: ${activity.address || 'Unknown'}

Consider factors like:
- Quality and reputation
- User experience
- Popularity
- Category-specific standards

Rating (1.0-5.0):`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a rating expert. Respond ONLY with a single number between 1.0 and 5.0, no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    const ratingText = data.choices[0]?.message?.content?.trim() || '4.0';
    
    // Extract number from response
    const ratingMatch = ratingText.match(/\d+\.?\d*/);
    const rating = ratingMatch ? parseFloat(ratingMatch[0]) : 4.0;
    
    // Ensure rating is between 1.0 and 5.0
    return Math.max(1.0, Math.min(5.0, rating));
  } catch (error) {
    console.error('Error calling Perplexity:', error);
    return calculateDefaultRating(activity);
  }
}

function calculateDefaultRating(activity: any): number {
  // Generate ratings based on category and score
  const baseRating = 3.5;
  const categoryBonus: Record<string, number> = {
    'food': 0.5,
    'cafe': 0.4,
    'restaurant': 0.5,
    'sports': 0.3,
    'shopping': 0.2,
    'music': 0.4,
    'concerts': 0.5,
    'movies': 0.3,
    'arts': 0.4,
  };

  const bonus = categoryBonus[activity.category?.toLowerCase()] || 0.2;
  
  // Add some variance based on match score if available
  const scoreBonus = activity.match_score ? (activity.match_score / 100) * 0.5 : 0;
  
  const rating = baseRating + bonus + scoreBonus + (Math.random() * 0.3 - 0.15);
  return Math.round(rating * 10) / 10; // Round to 1 decimal place
}
