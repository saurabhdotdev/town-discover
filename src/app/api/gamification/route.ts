import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { ensureAuthSetup, requireCurrentUser } from "@/lib/auth";
import { getUserStats } from "@/lib/gamification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) {
      return Response.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }

    await ensureAuthSetup(pool);
    const auth = await requireCurrentUser(pool, request);
    if (!auth.user) return auth.response;

    const stats = await getUserStats(pool, auth.user.id);
    return Response.json({ stats });
  } catch (e: any) {
    console.error("Error fetching gamification stats:", e);
    return Response.json({ error: "Internal server error", details: e.message }, { status: 500 });
  }
}
