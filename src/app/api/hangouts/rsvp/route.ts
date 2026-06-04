import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/server/api-handler";
import { awardXP, checkAndGrantBadges } from "@/lib/gamification";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "@/lib/server/api-errors";

const rsvpSchema = z.object({
  hangoutId: z.string().uuid({ message: "Invalid hangout ID format" }),
  status: z.enum(["going", "interested", "maybe"]).optional().default("going"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { auth: "required" },
  async (request: NextRequest, { pool, user }) => {
    const body = await request.json();
    const parseResult = rsvpSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestError("Invalid request data");
    }
    const { hangoutId, status } = parseResult.data;

    // Check if hangout exists and get host/place info
    const { rows: hangouts } = await pool.query(
      `SELECT user_id AS "userId", title, place_id AS "placeId" FROM place_hangouts WHERE id = $1`,
      [hangoutId]
    );
    if (hangouts.length === 0) {
      throw new NotFoundError("Hangout not found.");
    }
    const hostId = hangouts[0].userId;
    const hangoutTitle = hangouts[0].title;
    const placeId = hangouts[0].placeId;

    // Check if RSVP exists and fetch status
    const { rows: existingRsvps } = await pool.query(
      `SELECT status FROM hangout_rsvps WHERE hangout_id = $1 AND user_id = $2`,
      [hangoutId, user!.id]
    );

    const xpEventType = `rsvp_hangout:${hangoutId}`;
    let rsvped = false;
    let message = "";
    let newBadges: string[] = [];

    if (existingRsvps.length > 0) {
      const currentStatus = existingRsvps[0].status;
      if (currentStatus === status) {
        // Toggle off: remove the RSVP entirely
        await pool.query(
          `DELETE FROM hangout_rsvps WHERE hangout_id = $1 AND user_id = $2`,
          [hangoutId, user!.id]
        );

        // Revoke the +10 XP for this hangout
        await pool.query(
          `DELETE FROM user_xp_events WHERE user_id = $1 AND event_type = $2`,
          [user!.id, xpEventType]
        );

        rsvped = false;
        message = "RSVP removed successfully.";
      } else {
        // Update status of existing RSVP
        await pool.query(
          `UPDATE hangout_rsvps SET status = $3 WHERE hangout_id = $1 AND user_id = $2`,
          [hangoutId, user!.id, status]
        );

        // Notify the host about status update (if it's not the host updating their own RSVP)
        if (hostId !== user!.id) {
          const notifierName = user!.fullName || "Another explorer";
          await pool.query(
            `INSERT INTO user_notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              hostId,
              "rsvp_received",
              `RSVP updated for "${hangoutTitle}"`,
              `${notifierName} updated status to "${status}" for your hangout.`,
              `/discover?place=${placeId}`
            ]
          );
        }

        rsvped = true;
        message = `RSVP status updated to "${status}" successfully.`;
      }
    } else {
      // Create new RSVP
      await pool.query(
        `INSERT INTO hangout_rsvps (hangout_id, user_id, status) VALUES ($1, $2, $3)`,
        [hangoutId, user!.id, status]
      );

      // Notify the host about the new RSVP (if it's not the host RSVPing to their own hangout)
      if (hostId !== user!.id) {
        const notifierName = user!.fullName || "Another explorer";
        await pool.query(
          `INSERT INTO user_notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            hostId,
            "rsvp_received",
            `New RSVP for "${hangoutTitle}"`,
            `${notifierName} is marked as "${status}" for your hangout.`,
            `/discover?place=${placeId}`
          ]
        );
      }

      // Award XP
      const { rows: xpAwarded } = await pool.query(
        `SELECT 1 FROM user_xp_events WHERE user_id = $1 AND event_type = $2`,
        [user!.id, xpEventType]
      );

      if (xpAwarded.length === 0) {
        await awardXP(pool, user!.id, xpEventType, 10);
        newBadges = await checkAndGrantBadges(pool, user!.id);
      }

      rsvped = true;
      message = `RSVP marked as "${status}" successfully.`;
    }

    return Response.json({
      success: true,
      rsvped,
      newBadges,
      message,
    }, { status: rsvped ? 201 : 200 });
  }
);
