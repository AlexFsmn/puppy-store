import {Request, Response, NextFunction} from 'express';
import {z, ZodSchema} from 'zod';

export {z} from 'zod';

export interface ValidationError {
  field: string;
  message: string;
}

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({error: errors[0].message, errors});
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({error: errors[0].message, errors});
      return;
    }
    // Store parsed query in res.locals since req.query is read-only
    res.locals.query = result.data;
    next();
  };
}

// Common schema helpers
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
