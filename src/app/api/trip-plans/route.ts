import { NextRequest } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const coordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const stopSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  rating: z.number(),
  distance: z.number(),
  tags: z.array(z.string()),
  city: z.string(),
  locality: z.string(),
  isOpen: z.boolean(),
  isTrending: z.boolean(),
  reviewCount: z.number(),
  priceRange: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

const postSchema = z.object({
  name: z.string().trim().min(2).max(80),
  source: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(120),
  distanceKm: z.number().int().nonnegative().nullable().optional(),
  durationMinutes: z.number().int().nonnegative().nullable().optional(),
  routePath: z.array(coordinateSchema).max(1500),
  stops: z.array(stopSchema).max(80),
});

const serializePlan = (row: any) => ({
  id: row.id,
  name: row.name,
  source: row.source,
  destination: row.destination,
  distanceKm: row.distanceKm,
  durationMinutes: row.durationMinutes,
  routePath: row.routePath ?? [],
  stops: row.stops ?? [],
  createdAt: row.createdAt,
  ...(row.creatorName != null ? { creatorName: row.creatorName } : {}),
});

export const GET = createApiHandler({ auth: "optional" }, async (request, { pool, user }) => {
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const { rows } = await pool.query(
      `
      SELECT
        tp.id,
        tp.name,
        tp.source,
        tp.destination,
        tp.distance_km AS "distanceKm",
        tp.duration_minutes AS "durationMinutes",
        tp.route_path AS "routePath",
        tp.stops,
        tp.created_at AS "createdAt",
        u.full_name AS "creatorName"
      FROM trip_plans tp
      LEFT JOIN users u ON u.id = tp.user_id
      WHERE tp.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: "Trip plan not found." }, { status: 404 });
    }

    return Response.json({ plan: serializePlan(rows[0]) });
  }

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `
    SELECT
      id,
      name,
      source,
      destination,
      distance_km AS "distanceKm",
      duration_minutes AS "durationMinutes",
      route_path AS "routePath",
      stops,
      created_at AS "createdAt"
    FROM trip_plans
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 12
    `,
    [user!.id]
  );

  return Response.json({ plans: rows.map(serializePlan) });
});

export const POST = createApiHandler({ auth: "required" }, async (request, { pool, user }) => {
  const body = await request.json();
  const parseResult = postSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json({ error: "Invalid trip plan", details: parseResult.error.format() }, { status: 400 });
  }

  const plan = parseResult.data;
  const { rows } = await pool.query(
    `
    INSERT INTO trip_plans (
      user_id,
      name,
      source,
      destination,
      distance_km,
      duration_minutes,
      route_path,
      stops
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
    RETURNING
      id,
      name,
      source,
      destination,
      distance_km AS "distanceKm",
      duration_minutes AS "durationMinutes",
      route_path AS "routePath",
      stops,
      created_at AS "createdAt"
    `,
    [
      user!.id,
      plan.name,
      plan.source,
      plan.destination,
      plan.distanceKm ?? null,
      plan.durationMinutes ?? null,
      JSON.stringify(plan.routePath),
      JSON.stringify(plan.stops),
    ]
  );

  await pool.query(
    `
    INSERT INTO user_notifications (user_id, type, title, message, link)
    VALUES ($1, 'trip_saved', 'Trip plan saved', $2, $3)
    `,
    [
      user!.id,
      `${plan.name} is ready with ${plan.stops.length} suggested stops.`,
      `/trip/${rows[0].id}`,
    ]
  );

  return Response.json({ plan: serializePlan(rows[0]) }, { status: 201 });
});

