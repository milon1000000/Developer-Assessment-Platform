import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AssessmentInviteService } from "./assessmentInvite.service";

const sendAssessmentInvites = catchAsync(
	async (req: Request, res: Response) => {
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentInviteService.sendAssessmentInvites(
			req.body,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Assessment invitations processed successfully",
			data: result,
		});
	},
);

const getAllInvites = catchAsync(async (req: Request, res: Response) => {
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await AssessmentInviteService.getAllInvites(req.query, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessment invitations retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

const getInvitesByAssessmentId = catchAsync(
	async (req: Request, res: Response) => {
		const assessmentId = req.params.assessmentId as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentInviteService.getInvitesByAssessmentId(
			assessmentId,
			req.query,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Assessment invitations retrieved successfully",
			meta: result.meta,
			data: result.data,
		});
	},
);

const verifyInviteToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.params.token as string;
	const result = await AssessmentInviteService.verifyInviteToken(token);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invitation verified successfully",
		data: result,
	});
});

const resendAssessmentInvite = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentInviteService.resendAssessmentInvite(
			id,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Invitation resent successfully",
			data: result,
		});
	},
);

const deleteAssessmentInvite = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentInviteService.deleteAssessmentInvite(
			id,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Invitation cancelled successfully",
			data: result,
		});
	},
);

export const AssessmentInviteController = {
	sendAssessmentInvites,
	getAllInvites,
	getInvitesByAssessmentId,
	verifyInviteToken,
	resendAssessmentInvite,
	deleteAssessmentInvite,
};
