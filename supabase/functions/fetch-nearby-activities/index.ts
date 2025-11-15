import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, radius = 1000, category } = await req.json();

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch with retry and radius reduction on timeout
    async function fetchWithRetry(searchRadius: number, attempt: number = 1): Promise<any> {
      const categoryMap: { [key: string]: string[] } = {
        food: ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'],
        shopping: ['shop=supermarket', 'shop=mall', 'amenity=marketplace'],
        sports: ['leisure=sports_centre', 'leisure=fitness_centre', 'leisure=park'],
        studying: ['amenity=library', 'amenity=university', 'amenity=coworking_space'],
      };

      const tags = category && categoryMap[category] 
        ? categoryMap[category] 
        : Object.values(categoryMap).flat().slice(0, 8); // Limit to 8 tags

      const queries = tags.map(tag => {
        const [key, value] = tag.includes('=') ? tag.split('=') : [tag, ''];
        if (value) {
          return `node[${key}=${value}](around:${searchRadius},${lat},${lng});`;
        }
        return `node[${key}](around:${searchRadius},${lat},${lng});`;
      }).join('\n');

      const overpassQuery = `
        [out:json][timeout:15];
        (
          ${queries}
        );
        out body 100;
      `;

      console.log(`Attempt ${attempt}: Fetching from Overpass API with radius ${searchRadius}m...`);
      
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        // Retry with smaller radius if we have attempts left
        if (attempt < 3 && searchRadius > 500) {
          const newRadius = Math.floor(searchRadius / 2);
          console.log(`Retrying with smaller radius: ${newRadius}m`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
          return fetchWithRetry(newRadius, attempt + 1);
        }
        
        throw error;
      }
    }

    const data = await fetchWithRetry(radius);
    console.log(`Found ${data.elements?.length || 0} POIs`);

    // Transform and save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const activities = data.elements
      .filter((el: any) => el.lat && el.lon && el.tags?.name)
      .map((el: any) => {
        // Determine category
        let activityCategory = 'food';
        if (el.tags.shop || el.tags.amenity === 'marketplace') activityCategory = 'shopping';
        else if (el.tags.leisure || el.tags.sport) activityCategory = 'sports';
        else if (el.tags.amenity === 'library' || el.tags.amenity === 'university' || el.tags.amenity === 'coworking_space') activityCategory = 'studying';
        else if (el.tags.amenity === 'restaurant' || el.tags.amenity === 'cafe' || el.tags.amenity === 'fast_food' || el.tags.amenity === 'bar') activityCategory = 'food';

        return {
          name: el.tags.name,
          category: activityCategory,
          description: el.tags.description || el.tags.cuisine || el.tags.shop || null,
          lat: el.lat,
          lng: el.lon,
          address: el.tags['addr:street'] && el.tags['addr:housenumber']
            ? `${el.tags['addr:housenumber']} ${el.tags['addr:street']}`
            : el.tags['addr:full'] || null,
          price_level: el.tags['charge'] ? 2 : 1,
          rating: null,
          opening_hours: el.tags.opening_hours ? { hours: el.tags.opening_hours } : null,
          tags: el.tags,
          osm_id: el.id,
        };
      })
      .slice(0, 30); // Limit to 30 activities for better performance

    // Upsert activities to database
    if (activities.length > 0) {
      const { error: insertError } = await supabase
        .from('activities')
        .upsert(activities, { onConflict: 'osm_id', ignoreDuplicates: false });

      if (insertError) {
        console.error('Error inserting activities:', insertError);
      } else {
        console.log(`Inserted/updated ${activities.length} activities`);
      }
    }

    // Fetch activities from database (includes our computed location field)
    const { data: savedActivities, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .in('osm_id', activities.map((a: any) => a.osm_id));

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({ activities: savedActivities || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-nearby-activities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
