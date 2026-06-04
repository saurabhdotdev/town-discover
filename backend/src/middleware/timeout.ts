import { Request, Response, NextFunction } from "express";

export const requestTimeout = (timeoutMs = 15000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          error: "Request timed out. The server took too long to respond.",
        });
      }
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
};

export default requestTimeout;
