import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the JWT and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }

    const { email } = await req.json();
    console.log('Looking up user by email:', email);

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }

    // Prevent sending request to self
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Cannot send friend request to yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use admin client to look up user by email with pagination support
    let targetUser = null;
    let page = 1;
    const perPage = 1000;
    
    while (!targetUser) {
      const { data: users, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage
      });
      
      if (lookupError) {
        console.error('Error looking up users:', lookupError);
        throw lookupError;
      }

      targetUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      // If we found the user or there are no more pages, break
      if (targetUser || users.users.length < perPage) {
        break;
      }
      
      page++;
    }

    if (!targetUser) {
      return new Response(
        JSON.stringify({ 
          error: 'No user found with this email. Make sure they have created an account first.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found user:', targetUser.id);

    // Check if friendship already exists
    const { data: existingFriendship } = await supabaseAdmin
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`)
      .single();

    if (existingFriendship) {
      console.log('Friendship already exists:', existingFriendship);
      return new Response(
        JSON.stringify({ 
          error: 'Friend request already exists',
          status: existingFriendship.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create friend request
    const { data: friendship, error: insertError } = await supabaseAdmin
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: targetUser.id,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating friendship:', insertError);
      throw insertError;
    }

    console.log('Friend request created:', friendship);

    return new Response(
      JSON.stringify({ 
        success: true, 
        friendship,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-user-by-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
