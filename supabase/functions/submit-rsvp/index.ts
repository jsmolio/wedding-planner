import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, responses } = await req.json();

    if (!token || !responses || !Array.isArray(responses)) {
      return new Response(
        JSON.stringify({ error: 'Missing token or responses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify token exists and get guest IDs
    const { data: tokenData, error: tokenError } = await supabase
      .from('rsvp_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid RSVP token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update each guest
    for (const response of responses) {
      if (!tokenData.guest_ids.includes(response.guest_id)) {
        continue; // Skip guests not in this token
      }

      await supabase
        .from('guests')
        .update({
          rsvp_status: response.rsvp_status,
          dietary_restrictions: response.dietary_restrictions || '',
          meal_choice: response.meal_choice || '',
          plus_one_name: response.plus_one_name || '',
          rsvp_message: response.rsvp_message || '',
        })
        .eq('id', response.guest_id);
    }

    // Mark token as used
    await supabase
      .from('rsvp_tokens')
      .update({ is_used: true })
      .eq('id', tokenData.id);

    // Log activity
    await supabase.from('activity_log').insert({
      wedding_id: tokenData.wedding_id,
      action: 'RSVP submitted',
      entity_type: 'rsvp',
      details: `${responses.length} guest(s) responded`,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
