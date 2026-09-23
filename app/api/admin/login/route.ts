import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  constantTimeStringEqual,
  createSignedSessionValue,
  isSameOriginRequest,
} from "@/lib/auth";
import {
  LOGIN_RATE_LIMIT_WINDOW_MINUTES,
  getClientIp,
  isLoginRateLimited,
  recordLoginAttempt,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);

  if (await isLoginRateLimited(ip)) {
    return NextResponse.json(
      {
        error: `Trop de tentatives échouées. Réessaie dans ${LOGIN_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { password } = body ?? {};

  const expected = process.env.SUPERADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "SUPERADMIN_PASSWORD n'est pas configuré." },
      { status: 500 }
    );
  }

  const isValid =
    typeof password === "string" && constantTimeStringEqual(password, expected);

  if (!isValid) {
    await recordLoginAttempt(ip, false);
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  await recordLoginAttempt(ip, true);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createSignedSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  return response;
}
