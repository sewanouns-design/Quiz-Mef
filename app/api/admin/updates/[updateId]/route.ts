import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_LINK_LENGTH = 300;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const linkHref = typeof body?.linkHref === "string" ? body.linkHref.trim() : "";
  const linkLabel = typeof body?.linkLabel === "string" ? body.linkLabel.trim() : "";
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim().slice(0, 8) : "🆕";

  if (!title || !description) {
    return NextResponse.json({ error: "Le titre et la description sont requis." }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: "Titre ou description trop long." }, { status: 400 });
  }
  if (linkHref.length > MAX_LINK_LENGTH) {
    return NextResponse.json({ error: "Lien trop long." }, { status: 400 });
  }
  if (linkHref && !linkHref.startsWith("/") && !linkHref.startsWith("http")) {
    return NextResponse.json(
      { error: "Le lien doit être un chemin du site (/...) ou une URL complète." },
      { status: 400 }
    );
  }

  const { updateId } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_updates")
    .update({
      title,
      description,
      icon,
      link_href: linkHref || null,
      link_label: linkHref ? linkLabel || "Découvrir" : null,
    })
    .eq("id", updateId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Nouveauté introuvable." }, { status: 404 });
  }

  // Une modification ne rediffuse pas une notification push : il s'agit de la
  // même nouveauté et non d'une nouvelle publication.
  return NextResponse.json({ update: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const { updateId } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("site_updates").delete().eq("id", updateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
