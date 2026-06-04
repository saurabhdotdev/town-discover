import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool }) => {
    const { user, response } = await requireCurrentUser(pool, request);
    if (response) return response;

    await pool.query(
      `UPDATE users SET is_premium_pass = TRUE WHERE id = $1`,
      [user.id]
    );

    return Response.json({ success: true, message: "Subscription activated successfully! ✨" });
  }
);
