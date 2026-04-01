import { Request, Response } from "express"; // ✅ fixed: express.js → express
import { procedureService } from "./procedure.service.js"; // ✅ fixed path
import { logger } from "../../common/utils/logger.js"; // ✅ fixed path

const log = logger.child({ controller: "procedure" });

export const createProcedure = async (req: Request, res: Response) => {
  try {
    if (!req.userId || !req.userRole) { // ✅ ensure both are defined
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, description, price } = req.body;

    const procedure = await procedureService.createProcedure(
      req.userId,
      req.userRole,
      {
        name,
        description,
        price: parseFloat(price),
      }
    );

    res.status(201).json({ message: "Procedure created", procedure });
  } catch (e: any) {
    log.error({ err: e, route: "/procedure/create" });
    res.status(400).json({ error: String(e.message || e) });
  }
};

export const listProcedures = async (req: Request, res: Response) => {
  try {
    const providerId = req.query.providerId
      ? parseInt(req.query.providerId as string)
      : undefined;

    const procedures = await procedureService.listProcedures(providerId);
    res.json({ procedures }); // ✅ fixed: use res.json
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) });
  }
};

export const getProcedure = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const procedure = await procedureService.getProcedure(id);
    res.json({ procedure }); // ✅ fixed
  } catch (e: any) {
    res.status(404).json({ error: String(e.message || e) });
  }
};

export const updateProcedure = async (req: Request, res: Response) => {
  try {
    if (!req.userId || !req.userRole) { // ✅ ensure both are defined
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = parseInt(String(req.params.id));
    const { name, description, price } = req.body;

    const updated = await procedureService.updateProcedure(
      req.userId,
      req.userRole,
      id,
      { name, description, price: parseFloat(price) }
    );

    res.json({ message: "Procedure updated", updated }); // ✅ fixed
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
};

export const deleteProcedure = async (req: Request, res: Response) => {
  try {
    if (!req.userId || !req.userRole) { // ✅ ensure both are defined
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = parseInt(String(req.params.id));
    await procedureService.deleteProcedure(req.userId, req.userRole, id);
    res.json({ message: "Procedure deleted" }); // ✅ fixed
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) });
  }
};
