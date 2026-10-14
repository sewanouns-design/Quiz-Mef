import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");
  const from = validDate(fromParam) ? fromParam : formatDate(defaultFrom);
  const to = validDate(toParam) ? toParam : formatDate(now);

  if (from > to) {
    return NextResponse.json({ error: "La période Analytics est invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_admin_analytics", {
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("Erreur récupération Analytics :", error.message);
    return NextResponse.json({ error: "Impossible de charger les Analytics." }, { status: 500 });
  }

  return NextResponse.json({ from, to, analytics: data ?? {} });
}
