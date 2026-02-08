import type { Response } from 'express';
/**
 * GET /stock/reports/summary
 * Get overall stock summary for the clinic
 */
export declare const getStockSummary: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/reports/low-stock
 * Get items with low stock
 */
export declare const getLowStockItems: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/reports/consumption
 * Get consumption report for a date range
 */
export declare const getConsumptionReport: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/reports/consumption/by-patient
 * Get consumption grouped by patient
 */
export declare const getConsumptionByPatient: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/reports/movements
 * Get stock movement history
 */
export declare const getMovementsReport: (req: any, res: Response, next: import("express").NextFunction) => void;
/**
 * GET /stock/reports/expiring
 * Get items expiring soon
 */
export declare const getExpiringItems: (req: any, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=stock-reports.controller.d.ts.map