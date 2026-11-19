import httpStatus from "http-status";
import type { UploadApiResponse } from "cloudinary";
import type { Prisma } from "../../../generated/prisma/client";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IUpdateAdminProfilePayload,
	IUpdateRecruiterProfilePayload,
} from "./user.interface";

const getRecruiterProfile = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
		include: {
			recruiterProfile: {
				include: {
					_count: {
						select: {
							assessments: true,
						},
					},
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (!user.recruiterProfile) {
		throw new AppError(httpStatus.NOT_FOUND, "Recruiter profile not found");
	}

	return {
		id: user.recruiterProfile.id,
		userId: user.id,
		email: user.email,
		name: user.recruiterProfile.name,
		companyName: user.recruiterProfile.companyName,
		companyWebsite: user.recruiterProfile.companyWebsite,
		designation: user.recruiterProfile.designation,
		phone: user.recruiterProfile.phone,
		avatarUrl: user.recruiterProfile.avatarUrl,
		isVerified: user.recruiterProfile.isVerified,
		status: user.status,
		totalAssessments: user.recruiterProfile._count.assessments,
		createdAt: user.recruiterProfile.createdAt,
		updatedAt: user.recruiterProfile.updatedAt,
	};
};

const updateRecruiterProfile = async (
	userId: string,
	payload: IUpdateRecruiterProfilePayload,
	file?: Express.Multer.File,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { recruiterProfile: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role !== Role.RECRUITER && user.role !== Role.ADMIN) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only recruiters can update this profile",
		);
	}

	let recruiter = user.recruiterProfile;
	if (!recruiter) {
		recruiter = await prisma.recruiter.create({
			data: {
				userId: user.id,
				name: payload.name || user.email.split("@")[0],
				companyName: payload.companyName || "My Company",
			},
		});
	}

	let cloudinaryResult: UploadApiResponse | null = null;
	const fileBuffer = file?.buffer || payload.buffer;

	if (fileBuffer) {
		cloudinaryResult = await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				cloudinary.uploader
					.upload_stream(
						{ resource_type: "auto", folder: "recruiters" },
						(error, result) => {
							if (error) return reject(error);
							if (!result) return reject(new Error("Cloudinary error"));
							resolve(result);
						},
					)
					.end(fileBuffer);
			},
		);
	}

	const updated = await prisma.recruiter.update({
		where: { id: recruiter.id },
		data: {
			name: payload.name ?? undefined,
			companyName: payload.companyName ?? undefined,
			companyWebsite: payload.companyWebsite ?? undefined,
			designation: payload.designation ?? undefined,
			phone: payload.phone ?? undefined,
			avatarUrl: cloudinaryResult?.secure_url || payload.avatarUrl || undefined,
		},
	});

	return updated;
};

const getAdminProfile = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
		include: { adminProfile: true },
	});

	if (!user || !user.adminProfile) {
		throw new AppError(httpStatus.NOT_FOUND, "Admin profile not found");
	}

	return {
		id: user.adminProfile.id,
		userId: user.id,
		email: user.email,
		name: user.adminProfile.name,
		phone: user.adminProfile.phone,
		avatarUrl: user.adminProfile.avatarUrl,
		role: user.role,
		status: user.status,
		createdAt: user.adminProfile.createdAt,
	};
};

const updateAdminProfile = async (
	userId: string,
	payload: IUpdateAdminProfilePayload,
	file?: Express.Multer.File,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { adminProfile: true },
	});

	if (!user || user.role !== Role.ADMIN) {
		throw new AppError(httpStatus.FORBIDDEN, "Admin access required");
	}

	let admin = user.adminProfile;
	if (!admin) {
		admin = await prisma.admin.create({
			data: {
				userId: user.id,
				name: payload.name || user.email.split("@")[0],
			},
		});
	}

	let cloudinaryResult: UploadApiResponse | null = null;
	const fileBuffer = file?.buffer || payload.buffer;

	if (fileBuffer) {
		cloudinaryResult = await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				cloudinary.uploader
					.upload_stream(
						{ resource_type: "auto", folder: "admins" },
						(error, result) => {
							if (error) return reject(error);
							if (!result) return reject(new Error("Cloudinary error"));
							resolve(result);
						},
					)
					.end(fileBuffer);
			},
		);
	}

	const updated = await prisma.admin.update({
		where: { id: admin.id },
		data: {
			name: payload.name ?? undefined,
			phone: payload.phone ?? undefined,
			avatarUrl: cloudinaryResult?.secure_url || payload.avatarUrl || undefined,
		},
	});

	return updated;
};

const getAllUsers = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder =
		(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";

	const andConditions: Prisma.UserWhereInput[] = [{ isDeleted: false }];

	if (query.role) {
		andConditions.push({ role: query.role as Role });
	}

	if (query.status) {
		andConditions.push({ status: query.status as UserStatus });
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ email: { contains: query.searchTerm, mode: "insensitive" } },
				{
					developerProfile: {
						name: { contains: query.searchTerm, mode: "insensitive" },
					},
				},
				{
					recruiterProfile: {
						name: { contains: query.searchTerm, mode: "insensitive" },
					},
				},
				{
					recruiterProfile: {
						companyName: {
							contains: query.searchTerm,
							mode: "insensitive",
						},
					},
				},
			],
		});
	}

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: { AND: andConditions },
			take: limit,
			skip: skip,
			orderBy: { [sortBy]: sortOrder },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				authProvider: true,
				emailVerified: true,
				createdAt: true,
				developerProfile: {
					select: {
						id: true,
						name: true,
						phone: true,
						avatarUrl: true,
						skills: true,
					},
				},
				recruiterProfile: {
					select: {
						id: true,
						name: true,
						companyName: true,
						avatarUrl: true,
						isVerified: true,
					},
				},
				adminProfile: {
					select: {
						id: true,
						name: true,
						avatarUrl: true,
					},
				},
			},
		}),
		prisma.user.count({ where: { AND: andConditions } }),
	]);

	return {
		data: users,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getUserById = async (id: string) => {
	const user = await prisma.user.findUnique({
		where: { id, isDeleted: false },
		select: {
			id: true,
			email: true,
			role: true,
			status: true,
			authProvider: true,
			emailVerified: true,
			createdAt: true,
			updatedAt: true,
			developerProfile: true,
			recruiterProfile: {
				include: {
					_count: {
						select: { assessments: true },
					},
				},
			},
			adminProfile: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return user;
};

const changeUserStatus = async (id: string, status: UserStatus) => {
	const user = await prisma.user.findUnique({
		where: { id, isDeleted: false },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const updated = await prisma.user.update({
		where: { id },
		data: { status },
		select: {
			id: true,
			email: true,
			role: true,
			status: true,
			updatedAt: true,
		},
	});

	return updated;
};

const deleteUser = async (id: string) => {
	const user = await prisma.user.findUnique({
		where: { id, isDeleted: false },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const updated = await prisma.user.update({
		where: { id },
		data: {
			isDeleted: true,
			status: UserStatus.SUSPENDED,
			deletedAt: new Date(),
		},
	});

	return { message: "User deleted successfully" };
};

export const UserService = {
	getRecruiterProfile,
	updateRecruiterProfile,
	getAdminProfile,
	updateAdminProfile,
	getAllUsers,
	getUserById,
	changeUserStatus,
	deleteUser,
};
