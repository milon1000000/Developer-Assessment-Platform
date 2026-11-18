import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AssessmentService } from "./assessment.service";

const createAssessment = catchAsync(async (req: Request, res: Response) => {
	const recruiterUserId = req.user?.userId;
	if (!recruiterUserId) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
	}

	const result = await AssessmentService.createAssessment(
		req.body,
		recruiterUserId,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Assessment created successfully",
		data: result,
	});
});

const getAllAssessments = catchAsync(async (req: Request, res: Response) => {
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await AssessmentService.getAllAssessments(req.query, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessments retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

const getAssessmentById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await AssessmentService.getAssessmentById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessment retrieved successfully",
		data: result,
	});
});

const getAssessmentByInviteToken = catchAsync(
	async (req: Request, res: Response) => {
		const token = req.params.inviteToken as string;
		const result = await AssessmentService.getAssessmentByInviteToken(token);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Assessment details retrieved successfully",
			data: result,
		});
	},
);

const updateAssessment = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await AssessmentService.updateAssessment(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessment updated successfully",
		data: result,
	});
});

const deleteAssessment = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = { userId: req.user!.userId, role: req.user!.role };
	const result = await AssessmentService.deleteAssessment(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assessment deleted successfully",
		data: result,
	});
});

const addQuestionsToAssessment = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentService.addQuestionsToAssessment(
			id,
			req.body,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Questions added to assessment successfully",
			data: result,
		});
	},
);

const removeQuestionFromAssessment = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		console.log(id)
		const questionId = req.params.questionId as string;
		const user = { userId: req.user!.userId, role: req.user!.role };
		const result = await AssessmentService.removeQuestionFromAssessment(
			id,
			questionId,
			user,
		);

		console.log(result)

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Question removed from assessment successfully",
			data: result,
		});
	},
);

export const AssessmentController = {
	createAssessment,
	getAllAssessments,
	getAssessmentById,
	getAssessmentByInviteToken,
	updateAssessment,
	deleteAssessment,
	addQuestionsToAssessment,
	removeQuestionFromAssessment,
};
