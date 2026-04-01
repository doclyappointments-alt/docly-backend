import * as procedureModel from "./procedure.model.js"; // ✅ FIX: correct relative path
import * as providerModel from "../providers/provider.model.js"; // ✅ FIX: correct relative path

export const procedureService = {
  async createProcedure(
    userId: number,
    userRole: string,
    data: {
      name: string;
      description?: string;
      price: number;
      providerId?: number; // optional if ADMIN specifies
    }
  ) {
    const provider = await providerModel.findProviderByUserId(userId);
    if (!provider && userRole !== "ADMIN")
      throw new Error("Only PROVIDERS or ADMIN can create procedures");

    const providerId =
      userRole === "ADMIN" && data.providerId
        ? data.providerId
        : provider?.id;

    if (!providerId) throw new Error("Provider ID required");

    return procedureModel.createProcedure({ ...data, providerId });
  },

  async listProcedures(providerId?: number) {
    return procedureModel.listProcedures(providerId);
  },

  async getProcedure(id: number) {
    const proc = await procedureModel.getProcedureById(id);
    if (!proc) throw new Error("Procedure not found");
    return proc;
  },

  async updateProcedure(
    userId: number,
    userRole: string,
    id: number,
    data: {
      name?: string;
      description?: string;
      price?: number;
    }
  ) {
    const existing = await procedureModel.getProcedureById(id);
    if (!existing) throw new Error("Procedure not found");

    const provider = await providerModel.findProviderByUserId(userId);
    if (userRole !== "ADMIN" && provider?.id !== existing.providerId)
      throw new Error("Unauthorized");

    return procedureModel.updateProcedure(id, data);
  },

  async deleteProcedure(userId: number, userRole: string, id: number) {
    const existing = await procedureModel.getProcedureById(id);
    if (!existing) throw new Error("Procedure not found");

    const provider = await providerModel.findProviderByUserId(userId);
    if (userRole !== "ADMIN" && provider?.id !== existing.providerId)
      throw new Error("Unauthorized");

    return procedureModel.deleteProcedure(id);
  },
};
