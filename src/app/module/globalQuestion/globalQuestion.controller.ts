import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { GlobalQuestionService } from "./globalQuestion.service";

const createGlobalQuestion = catchAsync(async (req: Request, res: Response) => {
	const adminUserId = req.user?.userId;
	if (!adminUserId) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
	}

	const result = await GlobalQuestionService.createGlobalQuestion(
		req.body,
		adminUserId,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Global question created successfully",
		data: result,
	});
});

const getAllGlobalQuestions = catchAsync(
	async (req: Request, res: Response) => {
		const result = await GlobalQuestionService.getAllGlobalQuestions(req.query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Global questions retrieved successfully",
			meta: result.meta,
			data: result.data,
		});
	},
);

const getGlobalQuestionById = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const result = await GlobalQuestionService.getGlobalQuestionById(id);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Global question retrieved successfully",
			data: result,
		});
	},
);

const updateGlobalQuestion = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await GlobalQuestionService.updateGlobalQuestion(id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Global question updated successfully",
		data: result,
	});
});

const deleteGlobalQuestion = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await GlobalQuestionService.deleteGlobalQuestion(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Global question deleted successfully",
		data: result,
	});
});

export const GlobalQuestionController = {
	createGlobalQuestion,
	getAllGlobalQuestions,
	getGlobalQuestionById,
	updateGlobalQuestion,
	deleteGlobalQuestion,
};
