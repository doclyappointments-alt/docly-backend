// src/modules/search/search.routes.ts

import { Router } from "express";
import { searchProviders } from "./search.controller.js";

const router = Router();

/**
 * Public, read-only discovery
 * (Legacy shim — canonical search lives under /providers/search)
 */
router.get("/providers", searchProviders);

export default router;
