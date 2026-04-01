// src/modules/admin/admin.controller.ts
import type { Request, Response } from "express";
import * as AdminService from "./admin.service.js";

const getRangeParams = (req: Request) => {
  const { range, from, to } = req.query;

  return {
    range: typeof range === "string" ? range : undefined,
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
  };
};

export const getOverviewMetrics = async (req: Request, res: Response) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getOverviewMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getOverviewMetrics error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch overview metrics" });
  }
};

export const getBookingMetrics = async (req: Request, res: Response) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getBookingMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getBookingMetrics error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch booking metrics" });
  }
};

export const getProviderMetrics = async (req: Request, res: Response) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getProviderMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getProviderMetrics error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch provider metrics" });
  }
};

export const getHeatmapMetrics = async (req: Request, res: Response) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getHeatmapMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getHeatmapMetrics error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch heatmap metrics" });
  }
};

export const getProviderHealthMetrics = async (
  req: Request,
  res: Response,
) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getProviderHealthMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getProviderHealthMetrics error:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch provider health metrics",
    });
  }
};

export const getConversionMetrics = async (req: Request, res: Response) => {
  try {
    const params = getRangeParams(req);
    const data = await AdminService.getConversionMetrics(params);
    res.json(data);
  } catch (error: any) {
    console.error("getConversionMetrics error:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch conversion metrics",
    });
  }
};

// ---------------------
// Payments (Admin Read)
// ---------------------
export const getPayments = async (_req: Request, res: Response) => {
  try {
    const payments = await AdminService.getPayments();
    res.json({ payments });
  } catch (error: any) {
    console.error("getPayments error:", error);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

// ---------------------
// Payment Audit (Admin Read)
// ---------------------
export const getPaymentAudit = async (req: Request, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID required" });
    }

    const payment = await AdminService.getPaymentAudit(paymentId);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ payment });
  } catch (error: any) {
    console.error("getPaymentAudit error:", error);
    res.status(500).json({ message: "Failed to fetch payment audit" });
  }
};
