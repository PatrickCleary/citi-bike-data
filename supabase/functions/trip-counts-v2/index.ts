import { createClient } from "npm:@supabase/supabase-js@2.46.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
  },
});
const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  Connection: "keep-alive",
};
function isValidIsoDate(input) {
  // Basic ISO date check (YYYY-MM or YYYY-MM-DD)
  // Users are expected to pass a month date like "2025-09-01"
  const d = new Date(input);
  return !Number.isNaN(d.getTime());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: jsonHeaders,
      }
    );
  }
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(
      JSON.stringify({
        error: "Invalid JSON body.",
      }),
      {
        status: 400,
        headers: jsonHeaders,
      }
    );
  }
  const { target_month, reference_cell_ids, analysis_type } = body ?? {};
  if (!target_month || !Array.isArray(reference_cell_ids) || !analysis_type) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required fields: target_month (string), reference_cell_ids (string[]), analysis_type (string).",
      }),
      {
        status: 400,
        headers: jsonHeaders,
      }
    );
  }
  if (!isValidIsoDate(target_month)) {
    return new Response(
      JSON.stringify({
        error:
          "target_month must be an ISO-8601 date string (e.g., '2025-09-01').",
      }),
      {
        status: 400,
        headers: jsonHeaders,
      }
    );
  }
  // Call the Postgres function via RPC
  console.log(`[${Date.now()}] Starting RPC call`);
  const { data, error } = await supabase.rpc("analyze_trip_flows_v3", {
    target_month,
    reference_cell_ids,
    analysis_type,
  });
  console.log(`[${Date.now()}] RPC call complete`);
  if (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
  return new Response(
    JSON.stringify({
      data,
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});
