import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "@/lib/server/api-errors";

const flagSchema = z.object({
  hangoutId: z.string().uuid({ message: "Invalid hangout ID format" }),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = flagSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request data");
    }
    const { hangoutId } = parseResult.data;

    // Check if the meetup exists
    const { rows: hangouts } = await pool.query(
      `SELECT id FROM place_hangouts WHERE id = $1`,
      [hangoutId]
    );
    if (hangouts.length === 0) {
      throw new NotFoundError("Hangout not found.");
    }

    // Insert flag (primary key handles unique constraint)
    await pool.query(
      `INSERT INTO hangout_flags (hangout_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT (hangout_id, user_id) DO NOTHING`,
      [hangoutId, user!.id]
    );

    return Response.json({
      success: true,
      flagged: true,
      message: "Hangout reported successfully.",
    }, { status: 200 });
  }
);
