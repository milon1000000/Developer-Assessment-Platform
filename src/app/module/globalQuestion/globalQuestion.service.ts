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
	ICreateGlobalQuestionPayload,
	IUpdateGlobalQuestionPayload,
} from "./globalQuestion.interface";

const generateSlug = (title: string): string => {
	const cleanTitle = title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
	const uniqueId = Math.random().toString(36).substring(2, 8);
	return `${cleanTitle}-${uniqueId}`;
};

const createGlobalQuestion = async (
	payload: ICreateGlobalQuestionPayload,
	adminUserId: string,
) => {
	let admin = await prisma.admin.findUnique({
		where: { userId: adminUserId },
	});

	if (!admin) {
		const user = await prisma.user.findUnique({
			where: { id: adminUserId },
		});

		if (user && user.role === Role.ADMIN) {
			admin = await prisma.admin.create({
				data: {
					userId: user.id,
					name: user.email.split("@")[0],
				},
			});
		} else {
			throw new AppError(httpStatus.NOT_FOUND, "Admin profile not found");
		}
	}

	const slug = generateSlug(payload.title);

	const result = await prisma.globalQuestion.create({
		data: {
			title: payload.title,
			slug,
			type: payload.type || QuestionType.CODING,
			difficulty: payload.difficulty || Difficulty.EASY,
			tags: payload.tags || [],
			problemStatement: payload.problemStatement,
			constraints: payload.constraints || null,
			starterCode: payload.starterCode || undefined,
			testCases: payload.testCases || undefined,
			mcqOptions: payload.mcqOptions || undefined,
			correctOption: payload.correctOption || null,
			createdById: admin.id,
		},
		include: {
			createdBy: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	return result;
};

const getAllGlobalQuestions = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder =
		(query.sortOrder || query.SortOrder || "desc").toLowerCase() === "asc"
			? "asc"
			: "desc";

	const andConditions: Prisma.GlobalQuestionWhereInput[] = [
		{ isDeleted: false },
	];

	// Searching
	const searchTerm = query.searchTerm || query.search;
	if (searchTerm) {
		andConditions.push({
			OR: [
				{ title: { contains: searchTerm, mode: "insensitive" } },
				{
					problemStatement: { contains: searchTerm, mode: "insensitive" },
				},
			],
		});
	}

	// Filtering by title
	if (query.title) {
		andConditions.push({
			title: { contains: query.title as string, mode: "insensitive" },
		});
	}

	// Filtering by difficulty
	if (query.difficulty) {
		andConditions.push({
			difficulty: { equals: query.difficulty as Difficulty },
		});
	}

	// Filtering by type
	if (query.type) {
		andConditions.push({
			type: { equals: query.type as QuestionType },
		});
	}

	// Filtering by availability / active status
	if (query.isActive !== undefined) {
		andConditions.push({
			isActive: query.isActive === "true" || query.isActive === true,
		});
	}

	// Filtering by tags
	if (query.tags) {
		const tagsList = Array.isArray(query.tags)
			? (query.tags as string[])
			: typeof query.tags === "string"
				? query.tags.split(",").map((t: string) => t.trim())
				: [query.tags as string];
		andConditions.push({
			tags: { hasSome: tagsList },
		});
	}

	const [questions, total] = await Promise.all([
		prisma.globalQuestion.findMany({
			where: {
				AND: andConditions,
			},
			take: limit,
			skip: skip,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				createdBy: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
								role: true,
								status: true,
							},
						},
					},
				},
			},
		}),
		prisma.globalQuestion.count({
			where: {
				AND: andConditions,
			},
		}),
	]);

	return {
		data: questions,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getGlobalQuestionById = async (id: string) => {
	const result = await prisma.globalQuestion.findFirst({
		where: {
			OR: [{ id }, { slug: id }],
			isDeleted: false,
		},
		include: {
			createdBy: {
				include: {
					user: {
						select: {
							id: true,
							email: true,
							role: true,
							status: true,
						},
					},
				},
			},
		},
	});

	if (!result) {
		throw new AppError(httpStatus.NOT_FOUND, "Question not found");
	}

	return result;
};

const updateGlobalQuestion = async (
	id: string,
	payload: IUpdateGlobalQuestionPayload,
) => {
	const isQuestionExist = await prisma.globalQuestion.findFirst({
		where: {
			OR: [{ id }, { slug: id }],
			isDeleted: false,
		},
	});

	if (!isQuestionExist) {
		throw new AppError(httpStatus.NOT_FOUND, "Question not found");
	}

	const updateData: any = { ...payload };

	if (payload.title && payload.title !== isQuestionExist.title) {
		updateData.slug = generateSlug(payload.title);
	}

	const result = await prisma.globalQuestion.update({
		where: { id: isQuestionExist.id },
		data: updateData,
		include: {
			createdBy: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	return result;
};

const deleteGlobalQuestion = async (id: string) => {
	const isQuestionExist = await prisma.globalQuestion.findFirst({
		where: {
			OR: [{ id }, { slug: id }],
			isDeleted: false,
		},
	});

	if (!isQuestionExist) {
		throw new AppError(httpStatus.NOT_FOUND, "Question not found");
	}

	const result = await prisma.globalQuestion.update({
		where: { id: isQuestionExist.id },
		data: {
			isDeleted: true,
			isActive: false,
		},
	});

	return result;
};

export const GlobalQuestionService = {
	createGlobalQuestion,
	getAllGlobalQuestions,
	getGlobalQuestionById,
	updateGlobalQuestion,
	deleteGlobalQuestion,
};
