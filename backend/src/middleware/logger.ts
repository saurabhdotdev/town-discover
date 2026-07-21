import { Request, Response, NextFunction } from "express";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const { method, path, ip } = req;
  const userAgent = (req.get("user-agent") || "unknown").slice(0, 180);
  const requestId = res.getHeader("x-request-id") || "unknown";

  // Capture response finish event to calculate elapsed duration
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const timestamp = new Date().toISOString();

    let emoji = "🟢"; // 2xx success
    if (status >= 500) {
      emoji = "🔴"; // 5xx server error
    } else if (status >= 400) {
      emoji = "🟡"; // 4xx client error
    } else if (status >= 300) {
      emoji = "🔵"; // 3xx redirection
    }

    console.log(
      `[${timestamp}] ${emoji} ${method} ${path} - Status: ${status} | Request: ${requestId} | IP: ${ip} | Duration: ${duration}ms | UA: ${userAgent}`
    );
  });

  next();
};

export default requestLogger;
