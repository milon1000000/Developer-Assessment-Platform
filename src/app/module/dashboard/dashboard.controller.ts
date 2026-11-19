import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DashboardService } from "./dashboard.service";

const getAdminDashboard = catchAsync(async (req: Request, res: Response) => {
	const result = await DashboardService.getAdminDashboard();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin dashboard analytics retrieved successfully",
		data: result,
	});
});

const getRecruiterDashboard = catchAsync(
	async (req: Request, res: Response) => {
		const userId = req.user!.userId;
		const result = await DashboardService.getRecruiterDashboard(userId);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Recruiter dashboard analytics retrieved successfully",
			data: result,
		});
	},
);

const getDeveloperDashboard = catchAsync(
	async (req: Request, res: Response) => {
		const userId = req.user!.userId;
		const result = await DashboardService.getDeveloperDashboard(userId);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Developer dashboard overview retrieved successfully",
			data: result,
		});
	},
);

export const DashboardController = {
	getAdminDashboard,
	getRecruiterDashboard,
	getDeveloperDashboard,
};
