import { NextRequest } from "next/server";
import { authCookieName, getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(authCookieName)?.value;

  if (!sessionToken) {
    return Response.json({ user: null });
  }

  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ user: null });
    }

    const user = await getCurrentUser(pool, request);
    return Response.json({ user });
  } catch (error) {
    console.warn("[auth/me] Unable to load current user, continuing as guest:", error);
    return Response.json({ user: null });
  }
}
