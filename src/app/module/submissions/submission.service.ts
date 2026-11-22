import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	InviteStatus,
	ProctorEventType,
	QuestionType,
	Role,
	SubmissionStatus,
} from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import { executeCodeSuite, type ITestCaseItem } from "../../lib/codeRunner";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IProctorEventPayload,
	IReviewSubmissionPayload,
	IRunCodePayload,
	IStartAssessmentPayload,
	ISubmitAnswerPayload,
} from "./submission.interface";

// Helper: Get or gracefully auto-create developer profile (only for DEVELOPER role)
const getOrCreateDeveloper = async (userId: string, name: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { developerProfile: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role !== Role.DEVELOPER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only users with DEVELOPER role can participate in assessments or submit code",
		);
	}

	let developer = user.developerProfile;

	if (!developer) {
		developer = await prisma.developer.create({
			data: {
				userId: user.id,
				name: name || user.email.split("@")[0],
			},
		});
	}

	return developer;
};

const startAssessment = async (
	payload: IStartAssessmentPayload,
	user: { userId: string; role: Role; name: string; email: string },
	reqMeta: { ip?: string; userAgent?: string },
) => {
	const developer = await getOrCreateDeveloper(user.userId, user.name);

	let assessmentId = payload.assessmentId;

	// Resolve assessment via inviteToken if provided
	if (payload.inviteToken) {
		const invite = await prisma.assessmentInvite.findUnique({
			where: { token: payload.inviteToken },
		});

		if (invite) {
			assessmentId = invite.assessmentId;

			// Mark invite as accepted if still pending
			if (invite.status === InviteStatus.PENDING) {
				await prisma.assessmentInvite.update({
					where: { id: invite.id },
					data: {
						status: InviteStatus.ACCEPTED,
						acceptedAt: new Date(),
					},
				});
			}
		} else {
			// Check if it's the general assessment.inviteToken
			const assessmentByToken = await prisma.assessment.findUnique({
				where: { inviteToken: payload.inviteToken },
			});
			if (assessmentByToken) {
				assessmentId = assessmentByToken.id;
			} else {
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Invalid invite token or assessment not found",
				);
			}
		}
	}

	if (!assessmentId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assessment ID or valid inviteToken must be provided",
		);
	}

	const assessment = await prisma.assessment.findUnique({
		where: { id: assessmentId, isDeleted: false },
		include: {
			questions: {
				orderBy: { orderIndex: "asc" },
			},
			recruiter: {
				select: {
					name: true,
					companyName: true,
					avatarUrl: true,
				},
			},
		},
	});

	if (!assessment) {
		throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
	}

	if (!assessment.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This assessment is currently inactive",
		);
	}

	if (assessment.expiresAt && new Date() > assessment.expiresAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This assessment has expired and is no longer available",
		);
	}

	// Check if a submission already exists for this developer and assessment
	let submission = await prisma.submission.findUnique({
		where: {
			assessmentId_developerId: {
				assessmentId: assessment.id,
				developerId: developer.id,
			},
		},
		include: {
			answers: true,
		},
	});

	if (submission) {
		// If in progress, check if time limit has passed
		if (submission.status === SubmissionStatus.IN_PROGRESS) {
			const elapsedMinutes =
				(new Date().getTime() - new Date(submission.startedAt).getTime()) /
				(1000 * 60);

			if (elapsedMinutes > assessment.durationMinutes + 2) {
				submission = await prisma.submission.update({
					where: { id: submission.id },
					data: { status: SubmissionStatus.EXPIRED },
					include: { answers: true },
				});
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Assessment time limit has expired",
				);
			}

			// If still within duration, return existing session to allow continuation
		} else {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`You have already attempted this assessment. Current status: ${submission.status}`,
			);
		}
	} else {
		// Calculate maxScore from questions
		const maxScore = assessment.questions.reduce(
			(sum, q) => sum + (q.points || 10),
			0,
		);

		submission = await prisma.submission.create({
			data: {
				assessmentId: assessment.id,
				developerId: developer.id,
				status: SubmissionStatus.IN_PROGRESS,
				maxScore,
				ipAddress: reqMeta.ip || null,
				userAgent: reqMeta.userAgent || null,
			},
			include: {
				answers: true,
			},
		});
	}

	// Security: Sanitize questions by omitting correct answers and hidden test cases
	const sanitizedQuestions = assessment.questions.map((q) => {
		const { correctOption, testCases, ...safeQuestion } = q;
		const safeTestCases = Array.isArray(testCases)
			? testCases.filter((tc: any) => !tc.isHidden)
			: null;
		return {
			...safeQuestion,
			testCases: safeTestCases,
		};
	});

	return {
		submission,
		assessment: {
			id: assessment.id,
			title: assessment.title,
			description: assessment.description,
			durationMinutes: assessment.durationMinutes,
			passingScore: assessment.passingScore,
			maxTabSwitches: assessment.maxTabSwitches,
			recruiter: assessment.recruiter,
			questions: sanitizedQuestions,
		},
	};
};

const saveAnswer = async (
	submissionId: string,
	payload: ISubmitAnswerPayload,
	userId: string,
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			developer: true,
			assessment: true,
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.developer.userId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only submit answers to your own assessment session",
		);
	}

	if (submission.status !== SubmissionStatus.IN_PROGRESS) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot save answer. Submission is already ${submission.status}`,
		);
	}

	// Time check
	const elapsedMinutes =
		(new Date().getTime() - new Date(submission.startedAt).getTime()) /
		(1000 * 60);

	if (elapsedMinutes > submission.assessment.durationMinutes + 2) {
		await prisma.submission.update({
			where: { id: submission.id },
			data: { status: SubmissionStatus.EXPIRED },
		});
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assessment time limit has expired",
		);
	}

	const answerCode = payload.code || payload.submittedCode || null;

	const answer = await prisma.answer.upsert({
		where: {
			submissionId_questionId: {
				submissionId,
				questionId: payload.questionId,
			},
		},
		update: {
			selectedOption: payload.selectedOption ?? undefined,
			code: answerCode ?? undefined,
			language: payload.language ?? undefined,
			passedTestCases: payload.passedTestCases ?? undefined,
			totalTestCases: payload.totalTestCases ?? undefined,
		},
		create: {
			submissionId,
			questionId: payload.questionId,
			selectedOption: payload.selectedOption || null,
			code: answerCode,
			language: payload.language || null,
			passedTestCases: payload.passedTestCases || 0,
			totalTestCases: payload.totalTestCases || 0,
		},
	});

	return answer;
};

// Run code against sample/public test cases in sandbox
const runCode = async (
	submissionId: string,
	payload: IRunCodePayload,
	userId: string,
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			developer: true,
			assessment: {
				include: {
					questions: true,
				},
			},
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.developer.userId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only run code in your own active assessment session",
		);
	}

	if (submission.status !== SubmissionStatus.IN_PROGRESS) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot run code. Submission status is already ${submission.status}`,
		);
	}

	// Verify time limit
	const elapsedMinutes =
		(new Date().getTime() - new Date(submission.startedAt).getTime()) /
		(1000 * 60);

	if (elapsedMinutes > submission.assessment.durationMinutes + 2) {
		await prisma.submission.update({
			where: { id: submission.id },
			data: { status: SubmissionStatus.EXPIRED },
		});
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assessment duration has expired",
		);
	}

	const question = submission.assessment.questions.find(
		(q) => q.id === payload.questionId,
	);

	if (!question) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Question not found in this assessment",
		);
	}

	if (question.type !== QuestionType.CODING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Run code is only available for coding questions",
		);
	}

	// Live trial run only uses non-hidden (sample/public) test cases
	const allTestCases = Array.isArray(question.testCases)
		? (question.testCases as unknown as ITestCaseItem[])
		: [];

	const publicTestCases = allTestCases.filter((tc) => !tc.isHidden);
	const testCasesToRun =
		publicTestCases.length > 0 ? publicTestCases : allTestCases.slice(0, 2);

	const executionSummary = executeCodeSuite(
		payload.code,
		testCasesToRun,
		payload.language || "javascript",
	);

	// Auto-save the candidate's code draft and execution summary in the Answer table
	await prisma.answer.upsert({
		where: {
			submissionId_questionId: {
				submissionId,
				questionId: payload.questionId,
			},
		},
		update: {
			code: payload.code,
			language: payload.language || "javascript",
			passedTestCases: executionSummary.passedTestCases,
			totalTestCases: executionSummary.totalTestCases,
			executionDetails: executionSummary as any,
		},
		create: {
			submissionId,
			questionId: payload.questionId,
			code: payload.code,
			language: payload.language || "javascript",
			passedTestCases: executionSummary.passedTestCases,
			totalTestCases: executionSummary.totalTestCases,
			executionDetails: executionSummary as any,
		},
	});

	return executionSummary;
};

const recordProctorEvent = async (
	submissionId: string,
	payload: IProctorEventPayload,
	userId: string,
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			developer: true,
			assessment: true,
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.developer.userId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "Unauthorized submission access");
	}

	if (submission.status !== SubmissionStatus.IN_PROGRESS) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Assessment session is already ${submission.status}`,
		);
	}

	const detailsString =
		typeof payload.details === "object"
			? JSON.stringify(payload.details)
			: payload.details || null;

	// Log event
	await prisma.proctorLog.create({
		data: {
			submissionId,
			eventType: payload.eventType,
			details: detailsString,
		},
	});

	let tabSwitchCount = submission.tabSwitchCount;
	let copyPasteCount = submission.copyPasteCount;

	if (payload.eventType === ProctorEventType.TAB_SWITCH) {
		tabSwitchCount += 1;

		if (tabSwitchCount > submission.assessment.maxTabSwitches) {
			await prisma.submission.update({
				where: { id: submissionId },
				data: {
					tabSwitchCount,
					status: SubmissionStatus.DISQUALIFIED,
				},
			});

			return {
				disqualified: true,
				tabSwitchCount,
				maxAllowed: submission.assessment.maxTabSwitches,
				message:
					"You have been disqualified for exceeding the maximum allowed tab switches.",
			};
		}
	}

	if (payload.eventType === ProctorEventType.COPY_PASTE) {
		copyPasteCount += 1;
	}

	await prisma.submission.update({
		where: { id: submissionId },
		data: {
			tabSwitchCount,
			copyPasteCount,
		},
	});

	return {
		disqualified: false,
		tabSwitchCount,
		copyPasteCount,
		message: "Proctor event recorded successfully",
	};
};

const submitExam = async (submissionId: string, userId: string) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			developer: true,
			assessment: {
				include: {
					questions: true,
				},
			},
			answers: true,
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.developer.userId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only submit your own assessment",
		);
	}

	if (submission.status === SubmissionStatus.SUBMITTED) {
		return submission;
	}

	if (submission.status === SubmissionStatus.DISQUALIFIED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This submission was disqualified due to anti-cheating policy violation",
		);
	}

	// Automated Grading Engine
	let totalScore = 0;
	const questions = submission.assessment.questions;
	const answerMap = new Map(submission.answers.map((a) => [a.questionId, a]));

	for (const q of questions) {
		const ans = answerMap.get(q.id);
		let score = 0;

		if (q.type === QuestionType.MCQ) {
			if (ans?.selectedOption && q.correctOption) {
				const isCorrect =
					ans.selectedOption.trim().toLowerCase() ===
					q.correctOption.trim().toLowerCase();
				score = isCorrect ? q.points || 10 : 0;
			}
			if (ans) {
				await prisma.answer.update({
					where: { id: ans.id },
					data: {
						scoreEarned: score,
					},
				});
			}
		} else if (q.type === QuestionType.CODING) {
			let passedTestCases = 0;
			let totalTestCases = 0;
			let executionDetails: any = null;

			if (ans?.code && ans.code.trim().length > 0) {
				const allTestCases = Array.isArray(q.testCases)
					? (q.testCases as unknown as ITestCaseItem[])
					: [];

				if (allTestCases.length > 0) {
					const suiteResult = executeCodeSuite(
						ans.code,
						allTestCases,
						ans.language || "javascript",
					);
					passedTestCases = suiteResult.passedTestCases;
					totalTestCases = suiteResult.totalTestCases;
					executionDetails = suiteResult;

					const maxQuestionPoints = q.points || 10;
					score =
						totalTestCases > 0
							? Math.round(
									(passedTestCases / totalTestCases) * maxQuestionPoints * 100,
								) / 100
							: maxQuestionPoints;
				} else {
					score = ans.code.trim().length > 10 ? q.points || 10 : 0;
				}
			}

			if (ans) {
				await prisma.answer.update({
					where: { id: ans.id },
					data: {
						scoreEarned: score,
						passedTestCases,
						totalTestCases,
						executionDetails,
					},
				});
			}
		}

		totalScore += score;
	}

	const maxScore =
		submission.maxScore > 0
			? submission.maxScore
			: questions.reduce((acc, q) => acc + (q.points || 10), 0);

	const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
	const isPassed = percentage >= submission.assessment.passingScore;
	const timeSpentSeconds = Math.round(
		(new Date().getTime() - new Date(submission.startedAt).getTime()) / 1000,
	);

	const updatedSubmission = await prisma.submission.update({
		where: { id: submissionId },
		data: {
			status: SubmissionStatus.SUBMITTED,
			totalScore,
			percentage: Math.round(percentage * 100) / 100,
			isPassed,
			submittedAt: new Date(),
			timeSpentSeconds,
		},
		include: {
			answers: true,
			assessment: {
				select: {
					id: true,
					title: true,
					passingScore: true,
				},
			},
		},
	});

	return updatedSubmission;
};

const getMySubmissions = async (userId: string, query: IQuery) => {
	const developer = await prisma.developer.findUnique({
		where: { userId },
	});

	if (!developer) {
		return {
			data: [],
			meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
		};
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "startedAt";
	const sortOrder =
		(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";

	const andConditions: Prisma.SubmissionWhereInput[] = [
		{ developerId: developer.id },
	];

	if (query.status) {
		andConditions.push({ status: query.status as SubmissionStatus });
	}

	if (query.isPassed !== undefined) {
		andConditions.push({
			isPassed: query.isPassed === "true" || query.isPassed === true,
		});
	}

	const [submissions, total] = await Promise.all([
		prisma.submission.findMany({
			where: { AND: andConditions },
			take: limit,
			skip: skip,
			orderBy: { [sortBy]: sortOrder },
			include: {
				assessment: {
					select: {
						id: true,
						title: true,
						durationMinutes: true,
						passingScore: true,
						recruiter: {
							select: {
								name: true,
								companyName: true,
							},
						},
					},
				},
			},
		}),
		prisma.submission.count({ where: { AND: andConditions } }),
	]);

	return {
		data: submissions,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSubmissionsByAssessment = async (
	assessmentId: string,
	query: IQuery,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findUnique({
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
			"You can only view submissions for your own assessments",
		);
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "submittedAt";
	const sortOrder =
		(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";

	const andConditions: Prisma.SubmissionWhereInput[] = [{ assessmentId }];

	if (query.status) {
		andConditions.push({ status: query.status as SubmissionStatus });
	}

	if (query.isPassed !== undefined) {
		andConditions.push({
			isPassed: query.isPassed === "true" || query.isPassed === true,
		});
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					developer: {
						name: { contains: query.searchTerm, mode: "insensitive" },
					},
				},
				{
					developer: {
						user: {
							email: { contains: query.searchTerm, mode: "insensitive" },
						},
					},
				},
			],
		});
	}

	const [submissions, total] = await Promise.all([
		prisma.submission.findMany({
			where: { AND: andConditions },
			take: limit,
			skip: skip,
			orderBy: { [sortBy]: sortOrder },
			include: {
				developer: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
							},
						},
					},
				},
				_count: {
					select: {
						answers: true,
						proctorLogs: true,
					},
				},
			},
		}),
		prisma.submission.count({ where: { AND: andConditions } }),
	]);

	return {
		data: submissions,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSubmissionById = async (
	submissionId: string,
	user: { userId: string; role: Role },
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			developer: {
				include: {
					user: {
						select: {
							id: true,
							email: true,
						},
					},
				},
			},
			assessment: {
				include: {
					recruiter: {
						select: {
							id: true,
							userId: true,
							name: true,
							companyName: true,
						},
					},
				},
			},
			answers: {
				include: {
					question: true,
				},
			},
			proctorLogs: {
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	// Ownership validation
	if (
		user.role === Role.DEVELOPER &&
		submission.developer.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only access your own submission",
		);
	}

	if (
		user.role === Role.RECRUITER &&
		submission.assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view submissions for your own assessments",
		);
	}

	return submission;
};

const reviewSubmission = async (
	submissionId: string,
	payload: IReviewSubmissionPayload,
	user: { userId: string; role: Role },
) => {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			assessment: {
				include: { recruiter: true },
			},
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (
		user.role === Role.RECRUITER &&
		submission.assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only review submissions for your own assessments",
		);
	}

	const updateData: any = {
		reviewedAt: new Date(),
		feedback: payload.feedback !== undefined ? payload.feedback : undefined,
	};

	if (payload.totalScore !== undefined) {
		updateData.totalScore = payload.totalScore;
		if (submission.maxScore > 0) {
			updateData.percentage =
				Math.round((payload.totalScore / submission.maxScore) * 100 * 100) /
				100;
			updateData.isPassed =
				updateData.percentage >= submission.assessment.passingScore;
		}
	}

	const updated = await prisma.submission.update({
		where: { id: submissionId },
		data: updateData,
	});

	return updated;
};

export const SubmissionService = {
	startAssessment,
	saveAnswer,
	runCode,
	recordProctorEvent,
	submitExam,
	getMySubmissions,
	getSubmissionsByAssessment,
	getSubmissionById,
	reviewSubmission,
};
