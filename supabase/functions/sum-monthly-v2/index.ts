import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    // Parse request body
    const { origin_cell_ids, destination_cell_ids, year } = await req.json();
    // Validate that at least one cell array is provided
    const hasOrigins = origin_cell_ids && Array.isArray(origin_cell_ids) && origin_cell_ids.length > 0;
    const hasDestinations = destination_cell_ids && Array.isArray(destination_cell_ids) && destination_cell_ids.length > 0;
    if (!hasOrigins && !hasDestinations) {
      return new Response(JSON.stringify({
        error: 'At least one of origin_cell_ids or destination_cell_ids must be a non-empty array'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!year) {
      return new Response(JSON.stringify({
        error: 'Missing required parameter: year'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Call the PostgreSQL function
    const { data, error } = await supabaseClient.rpc('monthly_agg_v2', {
      p_origin_cells: origin_cell_ids || [],
      p_destination_cells: destination_cell_ids || [],
      p_year: year
    });
    if (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      data
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
