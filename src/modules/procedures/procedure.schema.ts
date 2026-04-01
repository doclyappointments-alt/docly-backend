// src/modules/procedures/procedure.schema
import { z } from 'zod';

export const createProcedureSchema = z.object({
  name: z.string().min(1, 'Procedure name is required'),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(1).max(1440).optional(), // minutes, max 24 hours
});

export const updateProcedureSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(1).max(1440).optional(),
});
