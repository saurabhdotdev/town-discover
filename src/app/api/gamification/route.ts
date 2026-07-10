import { NextRequest } from "next/server";
import { getUserStats } from "@/lib/gamification";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({ auth: "required" }, async (request, { pool, user }) => {
  const stats = await getUserStats(pool, user!.id);
  return Response.json({ stats });
});

