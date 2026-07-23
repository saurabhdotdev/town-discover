import { Request, Response, NextFunction } from "express";
import { AnyZodObject } from "zod";

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Replace request parts with parsed and typed Zod outputs
      req.body = parsed.body;
      req.query = parsed.query as any;
      req.params = parsed.params as any;
      next();
    } catch (error) {
      next(error);
    }
  };
};
