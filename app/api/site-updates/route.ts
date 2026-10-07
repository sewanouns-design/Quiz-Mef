import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Les N nouveautés les plus récentes, pour le pop-up fermable affiché aux
 * visiteurs (voir components/home/NewsPopup.tsx). Public, en lecture seule. */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_updates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updates: data ?? [] });
}
