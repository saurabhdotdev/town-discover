import { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ user: null });
  }

  try {
    const user = await getCurrentUser(pool, request);
    return Response.json({ user });
  } catch {
    return Response.json({ user: null });
  }
}
