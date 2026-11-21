import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateAuditLogPayload } from "./auditLog.interface";

/**
 * 1. Safe Helper to Record an Audit Log
 * Asynchronously writes to the AuditLog table without breaking the calling flow
 */
const createAuditLog = async (payload: ICreateAuditLogPayload) => {
	try {
		const log = await prisma.auditLog.create({
			data: {
				userId: payload.userId || null,
				action: payload.action,
				entity: payload.entity,
				entityId: payload.entityId || null,
				metadata: payload.metadata || undefined,
			},
		});
		return log;
	} catch (error) {
		console.error("[AuditLogService] Failed to record audit log:", error);
		return null;
	}
};

/**
 * 2. Get All Audit Logs (Admin Only)
 * Supports search, filter by action/entity/userId/date, sorting, and pagination
 */
const getAllAuditLogs = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy || "createdAt";
	const sortOrder =
		(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";

	const andConditions: Prisma.AuditLogWhereInput[] = [];

	if (query.action) {
		andConditions.push({
			action: { equals: query.action as string, mode: "insensitive" },
		});
	}

	if (query.entity) {
		andConditions.push({
			entity: { equals: query.entity as string, mode: "insensitive" },
		});
	}

	if (query.userId) {
		andConditions.push({ userId: query.userId as string });
	}

	if (query.startDate || query.endDate) {
		const dateFilter: Prisma.DateTimeFilter = {};
		if (query.startDate) {
			dateFilter.gte = new Date(query.startDate as string);
		}
		if (query.endDate) {
			dateFilter.lte = new Date(query.endDate as string);
		}
		andConditions.push({ createdAt: dateFilter });
	}

	if (query.searchTerm) {
		const search = query.searchTerm as string;
		andConditions.push({
			OR: [
				{ action: { contains: search, mode: "insensitive" } },
				{ entity: { contains: search, mode: "insensitive" } },
				{ entityId: { contains: search, mode: "insensitive" } },
				{
					user: {
						email: { contains: search, mode: "insensitive" },
					},
				},
			],
		});
	}

	const whereCondition: Prisma.AuditLogWhereInput =
		andConditions.length > 0 ? { AND: andConditions } : {};

	const [logs, total] = await Promise.all([
		prisma.auditLog.findMany({
			where: whereCondition,
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			include: {
				user: {
					select: {
						id: true,
						email: true,
						role: true,
						adminProfile: {
							select: { name: true },
						},
						recruiterProfile: {
							select: { name: true, companyName: true },
						},
						developerProfile: {
							select: { name: true },
						},
					},
				},
			},
		}),
		prisma.auditLog.count({ where: whereCondition }),
	]);

	return {
		meta: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
		data: logs,
	};
};

/**
 * 3. Get Single Audit Log Details by ID
 */
const getAuditLogById = async (id: string) => {
	const log = await prisma.auditLog.findUnique({
		where: { id },
		include: {
			user: {
				select: {
					id: true,
					email: true,
					role: true,
					adminProfile: { select: { name: true } },
					recruiterProfile: {
						select: { name: true, companyName: true },
					},
					developerProfile: { select: { name: true } },
				},
			},
		},
	});

	if (!log) {
		throw new AppError(httpStatus.NOT_FOUND, "Audit log not found");
	}

	return log;
};

/**
 * 4. Get Audit Analytics & Summary Stats
 */
const getAuditStats = async () => {
	const totalLogs = await prisma.auditLog.count();

	// Group counts by action
	const actionGroups = await prisma.auditLog.groupBy({
		by: ["action"],
		_count: {
			id: true,
		},
		orderBy: {
			_count: {
				id: "desc",
			},
		},
		take: 8,
	});

	// Group counts by entity
	const entityGroups = await prisma.auditLog.groupBy({
		by: ["entity"],
		_count: {
			id: true,
		},
		orderBy: {
			_count: {
				id: "desc",
			},
		},
	});

	return {
		totalLogs,
		topActions: actionGroups.map((g) => ({
			action: g.action,
			count: g._count.id,
		})),
		entities: entityGroups.map((g) => ({
			entity: g.entity,
			count: g._count.id,
		})),
	};
};

export const AuditLogService = {
	createAuditLog,
	getAllAuditLogs,
	getAuditLogById,
	getAuditStats,
};
