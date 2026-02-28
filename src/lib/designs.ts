import { supabase } from "@/integrations/supabase/client";

export interface Design {
  id: string;
  user_id: string;
  type: "evaluate" | "2d" | "3d";
  name: string;
  thumbnail_url: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function fetchDesigns(): Promise<Design[]> {
  const { data, error } = await supabase
    .from("designs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Design[];
}

export async function saveDesign(design: {
  type: "evaluate" | "2d" | "3d";
  name: string;
  thumbnail_url?: string | null;
  data: Record<string, unknown>;
}): Promise<Design> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("designs")
    .insert({ ...design, user_id: user.id } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Design;
}

export async function deleteDesign(id: string): Promise<void> {
  const { error } = await supabase.from("designs").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateDesign(id: string): Promise<Design> {
  const { data: original, error: fetchErr } = await supabase
    .from("designs")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !original) throw fetchErr || new Error("Not found");

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = original as any;
  const { data, error } = await supabase
    .from("designs")
    .insert({ ...rest, name: `${rest.name} (copy)` } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Design;
}
