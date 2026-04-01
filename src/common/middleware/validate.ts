// src/common/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        errors: result.error.issues.map(err => ({
          path: err.path,
          message: err.message,
        })),
      });
    }

    // Replace body with sanitized + typed data
    req.body = result.data;

    next();
  };
