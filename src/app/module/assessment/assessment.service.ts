import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	Difficulty,
	QuestionType,
	Role,
} from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAddQuestionsToAssessmentPayload,
	IAssessmentQuestionItem,
	ICreateAssessmentPayload,
	IUpdateAssessmentPayload,
} from "./assessment.interface";

// Helper: Get or gracefully auto-create recruiter profile for authenticated recruiter/admin
const getOrCreateRecruiter = async (userId: string) => {
	let recruiter = await prisma.recruiter.findUnique({
		where: { userId },
	});

	if (!recruiter) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (user && (user.role === Role.RECRUITER || user.role === Role.ADMIN)) {
			recruiter = await prisma.recruiter.create({
				data: {
					userId: user.id,
					name: user.email.split("@")[0],
					companyName: "Default Company",
					isVerified: true,
				},
			});
		} else {
			throw new AppError(httpStatus.NOT_FOUND, "Recruiter profile not found");
		}
	}

	return recruiter;
};

// Helper to format/resolve a single question (from global question bank or custom)
const resolveQuestionData = async (
	item: IAssessmentQuestionItem,
	index: number,
) => {
	if (item.globalQuestionId) {
		const globalQuestion = await prisma.globalQuestion.findUnique({
			where: { id: item.globalQuestionId, isDeleted: false },
		});

		if (!globalQuestion) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				`Global question not found for ID: ${item.globalQuestionId}`,
			);
		}

		return {
			globalQuestionId: globalQuestion.id,
			title: item.title || globalQuestion.title,
			type: item.type || globalQuestion.type,
			difficulty: item.difficulty || globalQuestion.difficulty,
			problemStatement:
				item.problemStatement || globalQuestion.problemStatement,
			constraints: item.constraints || globalQuestion.constraints,
			starterCode: item.starterCode ?? (globalQuestion.starterCode as any),
			testCases: item.testCases ?? (globalQuestion.testCases as any),
			mcqOptions: item.mcqOptions ?? (globalQuestion.mcqOptions as any),
			correctOption: item.correctOption ?? globalQuestion.correctOption,
			points: item.points ?? 10,
			orderIndex: item.orderIndex ?? index,
		};
	}

	if (!item.title || !item.problemStatement) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Custom question must include both title and problemStatement",
		);
	}

	return {
		globalQuestionId: null,
		title: item.title,
		type: item.type || QuestionType.CODING,
		difficulty: item.difficulty || Difficulty.EASY,
		problemStatement: item.problemStatement,
		constraints: item.constraints || null,
		starterCode: item.starterCode ?? undefined,
		testCases: item.testCases ?? undefined,
		mcqOptions: item.mcqOptions ?? undefined,
		correctOption: item.correctOption || null,
		points: item.points ?? 10,
		orderIndex: item.orderIndex ?? index,
	};
};

const createAssessment = async (
	payload: ICreateAssessmentPayload,
	recruiterUserId: string,
) => {
	const recruiter = await getOrCreateRecruiter(recruiterUserId);

	let questionsData: any[] = [];
	if (payload.questions && payload.questions.length > 0) {
		questionsData = await Promise.all(
			payload.questions.map((q, idx) => resolveQuestionData(q, idx)),
		);
	}

	const result = await prisma.assessment.create({
		data: {
			title: payload.title,
			description: payload.description || null,
			durationMinutes: payload.durationMinutes ?? 60,
			passingScore: payload.passingScore ?? 60,
			maxTabSwitches: payload.maxTabSwitches ?? 3,
			expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
			recruiterId: recruiter.id,
			questions:
				questionsData.length > 0
					? {
							create: questionsData,
						}
					: undefined,
		},
		include: {
			recruiter: {
				select: {
					id: true,
					name: true,
					companyName: true,
					avatarUrl: true,
				},
			},
			questions: {
				orderBy: {
					orderIndex: "asc",
				},
			},
		},
	});

	return result;
};

const getAllAssessments = async (
	query: IQuery,
	user: { userId: string; role: Role },
) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder =
		(query.sortOrder || query.SortOrder || "desc").toLowerCase() === "asc"
			? "asc"
			: "desc";

	const andConditions: Prisma.AssessmentWhereInput[] = [{ isDeleted: false }];

	// Recruiter can only see their own assessments; Admin can see all or filter by recruiterId
	if (user.role === Role.RECRUITER) {
		andConditions.push({
			recruiter: { userId: user.userId },
		});
	} else if (query.recruiterId) {
		andConditions.push({
			recruiterId: query.recruiterId as string,
		});
	}

	// Searching
	const searchTerm = query.searchTerm || query.search;
	if (searchTerm) {
		andConditions.push({
			OR: [
				{ title: { contains: searchTerm, mode: "insensitive" } },
				{ description: { contains: searchTerm, mode: "insensitive" } },
			],
		});
	}

	// Filtering by title
	if (query.title) {
		andConditions.push({
			title: { contains: query.title as string, mode: "insensitive" },
		});
	}

	// Filtering by availability / active status
	if (query.isActive !== undefined) {
		andConditions.push({
			isActive: query.isActive === "true" || query.isActive === true,
		});
	}

	const [assessments, total] = await Promise.all([
		prisma.assessment.findMany({
			where: {
				AND: andConditions,
			},
			take: limit,
			skip: skip,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				recruiter: {
					select: {
						id: true,
						name: true,
						companyName: true,
						avatarUrl: true,
					},
				},
				_count: {
					select: {
						questions: true,
						invites: true,
						submissions: true,
					},
				},
			},
		}),
		prisma.assessment.count({
			where: {
				AND: andConditions,
			},
		}),
	]);

	return {
		data: assessments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getAssessmentById = async (
	id: string,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id, isDeleted: false },
		include: {
			recruiter: {
				select: {
					id: true,
					userId: true,
					name: true,
					companyName: true,
					companyWebsite: true,
					avatarUrl: true,
				},
			},
			questions: {
				orderBy: {
					orderIndex: "asc",
				},
			},
			_count: {
				select: {
					invites: true,
					submissions: true,
				},
			},
		},
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	// If recruiter, check ownership
	if (
		user.role === Role.RECRUITER &&
		assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own assessments",
		);
	}

	// If developer, omit correct answers & hidden test cases
	if (user.role === Role.DEVELOPER) {
		assessment.questions = assessment.questions.map((q) => {
			const sanitized = { ...q, correctOption: null };
			if (Array.isArray(sanitized.testCases)) {
				sanitized.testCases = sanitized.testCases.filter(
					(tc: any) => !tc.isHidden,
				);
			}
			return sanitized as any;
		});
	}

	return assessment;
};

const getAssessmentByInviteToken = async (inviteToken: string) => {
	const assessment = await prisma.assessment.findFirst({
		where: {
			inviteToken,
			isDeleted: false,
			isActive: true,
		},
		include: {
			recruiter: {
				select: {
					name: true,
					companyName: true,
					avatarUrl: true,
				},
			},
			questions: {
				orderBy: {
					orderIndex: "asc",
				},
				select: {
					id: true,
					title: true,
					type: true,
					difficulty: true,
					points: true,
					orderIndex: true,
				},
			},
		},
	});

	if (!assessment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Assessment not found or invite token is invalid",
		);
	}

	if (assessment.expiresAt && new Date() > assessment.expiresAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This assessment has expired and is no longer accessible",
		);
	}

	return assessment;
};

const updateAssessment = async (
	id: string,
	payload: IUpdateAssessmentPayload,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id, isDeleted: false },
		include: { recruiter: true },
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	if (
		user.role === Role.RECRUITER &&
		assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update your own assessments",
		);
	}

	const updateData: any = { ...payload };
	if (payload.expiresAt) {
		updateData.expiresAt = new Date(payload.expiresAt);
	}

	const result = await prisma.assessment.update({
		where: { id },
		data: updateData,
		include: {
			recruiter: {
				select: {
					id: true,
					name: true,
					companyName: true,
				},
			},
			questions: {
				orderBy: {
					orderIndex: "asc",
				},
			},
		},
	});

	return result;
};

const deleteAssessment = async (
	id: string,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id, isDeleted: false },
		include: { recruiter: true },
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	if (
		user.role === Role.RECRUITER &&
		assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete your own assessments",
		);
	}

	const result = await prisma.assessment.update({
		where: { id },
		data: {
			isDeleted: true,
			isActive: false,
		},
	});

	return result;
};

const addQuestionsToAssessment = async (
	assessmentId: string,
	payload: IAddQuestionsToAssessmentPayload,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id: assessmentId, isDeleted: false },
		include: { recruiter: true, questions: true },
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	if (
		user.role === Role.RECRUITER &&
		assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only add questions to your own assessments",
		);
	}

	const startIndex = assessment.questions.length;
	const resolvedQuestions = await Promise.all(
		payload.questions.map((q, idx) => resolveQuestionData(q, startIndex + idx)),
	);

	await prisma.$transaction(
		resolvedQuestions.map((q) =>
			prisma.assessmentQuestion.create({
				data: {
					...q,
					assessmentId,
				},
			}),
		),
	);

	const updatedQuestions = await prisma.assessmentQuestion.findMany({
		where: { assessmentId },
		orderBy: { orderIndex: "asc" },
	});

	return updatedQuestions;
};

const removeQuestionFromAssessment = async (
	assessmentId: string,
	questionId: string,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id: assessmentId, isDeleted: false },
		include: { recruiter: true },
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	if (
		user.role === Role.RECRUITER &&
		assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only remove questions from your own assessments",
		);
	}

	const question = await prisma.assessmentQuestion.findFirst({
		where: { id: questionId, assessmentId },
	});

	if (!question) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Question not found in this assessment",
		);
	}

	await prisma.assessmentQuestion.delete({
		where: { id: questionId },
	});

	return { message: "Question removed successfully" };
};

export const AssessmentService = {
	createAssessment,
	getAllAssessments,
	getAssessmentById,
	getAssessmentByInviteToken,
	updateAssessment,
	deleteAssessment,
	addQuestionsToAssessment,
	removeQuestionFromAssessment,
};
