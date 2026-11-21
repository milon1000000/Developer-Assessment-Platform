import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuditLogService } from "./auditLog.service";

const getAllAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;
	const result = await AuditLogService.getAllAuditLogs(query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

const getAuditLogById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await AuditLogService.getAuditLogById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit log details retrieved successfully",
		data: result,
	});
});

const getAuditStats = catchAsync(async (req: Request, res: Response) => {
	const result = await AuditLogService.getAuditStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit statistics retrieved successfully",
		data: result,
	});
});

export const AuditLogController = {
	getAllAuditLogs,
	getAuditLogById,
	getAuditStats,
};
