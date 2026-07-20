import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

const getClientKey = (req: Request) => {
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per 15 minutes
  keyGenerator: getClientKey,
  skip: (req) => req.path === "/health",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

export const reportPostLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 crowd report submissions per 10 minutes
  keyGenerator: getClientKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many report submissions from this IP, please try again after 10 minutes.",
  },
});

export const dealLaunchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: getClientKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many deal launch attempts. Please try again later.",
  },
});
