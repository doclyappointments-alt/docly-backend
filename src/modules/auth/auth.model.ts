// src/modules/auth/auth.model.ts

// ✅ Central re-exports for models and DTOs

// Common DTOs
export * from "../../common/dto/user.dto.js";
export * from "../../common/dto/provider.dto.js";
export * from "../../common/dto/appointment.dto.js";
export * from "../../common/dto/slot.dto.js";
export * from "../../common/dto/googleEvent.dto.js";

// Module Models
export * from "../users/user.model.js";
export * from "../providers/provider.model.js";
export * from "../appointments/appointment.model.js";
export * from "../appointments/slot.model.js";
export * from "../google/googleEvent.model.js";
