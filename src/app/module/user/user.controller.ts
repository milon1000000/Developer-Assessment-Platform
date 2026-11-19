import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const getRecruiterProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.getRecruiterProfile(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Recruiter profile retrieved successfully",
		data: result,
	});
});

const updateRecruiterProfile = catchAsync(
	async (req: Request, res: Response) => {
		const userId = req.user!.userId;
		const result = await UserService.updateRecruiterProfile(
			userId,
			req.body,
			req.file,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Recruiter profile updated successfully",
			data: result,
		});
	},
);

const getAdminProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.getAdminProfile(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin profile retrieved successfully",
		data: result,
	});
});

const updateAdminProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.updateAdminProfile(
		userId,
		req.body,
		req.file,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin profile updated successfully",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await UserService.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await UserService.getUserById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User details retrieved successfully",
		data: result,
	});
});

const changeUserStatus = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await UserService.changeUserStatus(id, req.body.status);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await UserService.deleteUser(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User deleted successfully",
		data: result,
	});
});

const getPendingRecruiterApplications = catchAsync(
	async (req: Request, res: Response) => {
		const query = req.query;
		const result = await UserService.getPendingRecruiterApplications(query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Pending recruiter applications retrieved successfully",
			meta: result.meta,
			data: result.data,
		});
	},
);

const approveRecruiterApplication = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const result = await UserService.approveRecruiterApplication(id);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: result.message,
			data: result,
		});
	},
);

const rejectRecruiterApplication = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const result = await UserService.rejectRecruiterApplication(id, req.body);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: result.message,
			data: null,
		});
	},
);

export const UserController = {
	getRecruiterProfile,
	updateRecruiterProfile,
	getAdminProfile,
	updateAdminProfile,
	getAllUsers,
	getUserById,
	changeUserStatus,
	deleteUser,
	getPendingRecruiterApplications,
	approveRecruiterApplication,
	rejectRecruiterApplication,
};
