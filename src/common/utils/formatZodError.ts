// src/common/utils/formatZodError
import { ZodError, ZodIssue } from 'zod';

/**
 * Formats a ZodError into a simple array of messages
 */
export const formatZodError = (err: ZodError): string[] => {
  return err.issues.map((issue: ZodIssue) => issue.message);
};
