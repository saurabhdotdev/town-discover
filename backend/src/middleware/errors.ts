import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod/v3";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the actual error internally
  console.error("❌ Error encountered:", {
    path: req.path,
    method: req.method,
    message: err.message || err,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });

  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod Schema Validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      details: err.errors.map((e) => ({
        path: e.path.filter((p) => p !== "body" && p !== "query" && p !== "params").join("."),
        message: e.message,
      })),
    });
    return;
  }

  const status = err.status || err.statusCode || 500;
  
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 429) {
    res.status(status).json({ error: err.message || "An error occurred." });
    return;
  }

  // Obfuscate database/system errors
  res.status(500).json({
    error: "Service temporarily unavailable. Please try again later.",
  });
};
