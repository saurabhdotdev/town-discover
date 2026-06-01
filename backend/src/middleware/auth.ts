import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import db from "../db";

const authCookieName = "town_discover_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

const hashSessionToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("base64url");
};

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies ? req.cookies[authCookieName] : undefined;
    if (!token) {
      req.user = null;
      return next();
    }

    const { rows } = await db.query<AuthenticatedUser>(
      `
      SELECT
        users.id,
        users.email,
        users.full_name AS "fullName",
        users.role
      FROM auth_sessions
      JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = $1
        AND auth_sessions.expires_at > NOW()
      LIMIT 1
      `,
      [hashSessionToken(token)]
    );

    req.user = rows[0] ?? null;
    next();
  } catch (error) {
    req.user = null;
    next(error);
  }
};

export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Please log in first." });
    return;
  }
  next();
};
