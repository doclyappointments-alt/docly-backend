import { Request, Response } from "express";

/**
 * Legacy / placeholder search controller.
 * Phase 4 canonical discovery lives under /provider/search.
 */
export async function searchProviders(_req: Request, res: Response) {
  return res.status(501).json({
    error: "Use /provider/search for discovery",
  });
}
