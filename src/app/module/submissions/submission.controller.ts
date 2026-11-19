import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SubmissionService } from "./submission.service";

const startAssessment = catchAsync(async (req: Request, res: Response) => {
	const user = {
		userId: req.user!.userId,
		role: req.user!.role,
		name: req.user!.name,
		email: req.user!.email,
	};
	const reqMeta = {
		ip: req.ip || (req.headers["x-forwarded-for"] as string),
		userAgent: req.headers["user-agent"],
	};

	const result = await SubmissionService.startAssessment(
		req.body,
		user,
		reqMeta,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Assessment session started successfully",
		data: result,
	});
});

const saveAnswer = catchAsync(async (req: Request, res: Response) => {
	const submissionId = req.params.id as string;
	const userId = req.user!.userId;
	const result = await SubmissionService.saveAnswer(
		submissionId,
		req.body,
		userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Answer saved successfully",
		data: result,
	});
});

const recordProctorEvent = catchAsync(async (req: Request, res: Response) => {
	const submissionId = req.params.id as string;
	const userId = req.user!.userId;
	const result = await SubmissionService.recordProctorEvent(
		submissionId,
		req.body,
		userId,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: result,
	});
});

const submitExam = catchAsync(async (req: Request, res: Response) => {
	const submissionId = req.params.id as string;
	const userId = req.user!.userId;
	const result = await SubmissionService.submitExam(submissionId, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessment submitted and evaluated successfully",
		data: result,
	});
});

const getMySubmissions = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await SubmissionService.getMySubmissions(userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My assessment submissions retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

const getSubmissionsByAssessment = catchAsync(
	async (req: Request, res: Response) => {
		const assessmentId = req.params.assessmentId as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await SubmissionService.getSubmissionsByAssessment(
			assessmentId,
			req.query,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Assessment submissions retrieved successfully",
			meta: result.meta,
			data: result.data,
		});
	},
);

const getSubmissionById = catchAsync(async (req: Request, res: Response) => {
	const submissionId = req.params.id as string;
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await SubmissionService.getSubmissionById(submissionId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission details retrieved successfully",
		data: result,
	});
});

const reviewSubmission = catchAsync(async (req: Request, res: Response) => {
	const submissionId = req.params.id as string;
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await SubmissionService.reviewSubmission(
		submissionId,
		req.body,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission reviewed successfully",
		data: result,
	});
});

export const SubmissionController = {
	startAssessment,
	saveAnswer,
	recordProctorEvent,
	submitExam,
	getMySubmissions,
	getSubmissionsByAssessment,
	getSubmissionById,
	reviewSubmission,
};
