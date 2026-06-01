import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { authCookieName, ensureAuthSetup, getExpiredSessionCookieOptions, hashSessionToken } from "@/lib/auth";
import { requireTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const originResponse = requireTrustedOrigin(request);
  if (originResponse) return originResponse;

  const pool = getPool();
  const token = request.cookies.get(authCookieName)?.value;

  if (pool && token) {
    await ensureAuthSetup(pool);
    await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, "", getExpiredSessionCookieOptions());
  return response;
}
