import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { auth: "none" },
  async (request: NextRequest, { pool }) => {
    const user = await getCurrentUser(pool, request);
    return Response.json({ user });
  }
);
