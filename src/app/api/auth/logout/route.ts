import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { authCookieName, getExpiredSessionCookieOptions, hashSessionToken } from "@/lib/auth";
import { requireTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "none" },
  async (request: NextRequest, { pool }) => {
    const originResponse = requireTrustedOrigin(request);
    if (originResponse) return originResponse;

    const token = request.cookies.get(authCookieName)?.value;

    if (token) {
      await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(authCookieName, "", getExpiredSessionCookieOptions());
    return response;
  }
);
