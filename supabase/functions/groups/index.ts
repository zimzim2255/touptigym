import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const allSegments = url.pathname.split("/").filter(Boolean);
    const groupsIdx = allSegments.lastIndexOf("groups");
    const segments = groupsIdx >= 0 ? allSegments.slice(groupsIdx + 1) : [];
    const method = req.method;

    // GET /groups — list all groups with exercises
    if (method === "GET" && segments.length === 0) {
      const { data, error } = await supabase
        .from("groups")
        .select("*, exercises(*)")
        .order("name");
      if (error) return errorResponse(error.message, 500);
      return jsonResponse(data);
    }

    // GET /groups/:id — single group with exercises
    if (method === "GET" && segments.length === 1) {
      const { data, error } = await supabase
        .from("groups")
        .select("*, exercises(*)")
        .eq("id", segments[0])
        .single();
      if (error) return errorResponse("Group not found", 404);
      return jsonResponse(data);
    }

    // POST /groups — create a group
    if (method === "POST" && segments.length === 0) {
      const body = await req.json();
      const { data, error } = await supabase
        .from("groups")
        .insert([{ name: body.name, description: body.description || "" }])
        .select()
        .single();
      if (error) return errorResponse(error.message);
      return jsonResponse(data, 201);
    }

    // PUT /groups/:id — update a group
    if (method === "PUT" && segments.length === 1) {
      const body = await req.json();
      const { data, error } = await supabase
        .from("groups")
        .update({ name: body.name, description: body.description })
        .eq("id", segments[0])
        .select()
        .single();
      if (error) return errorResponse(error.message);
      return jsonResponse(data);
    }

    // DELETE /groups/:id — delete a group
    if (method === "DELETE" && segments.length === 1) {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", segments[0]);
      if (error) return errorResponse(error.message);
      return jsonResponse({ deleted: true });
    }

    return errorResponse("Not found", 404);
  } catch (err: any) {
    return errorResponse(err.message, 500);
  }
});