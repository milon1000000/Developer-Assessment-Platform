import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { InviteStatus, Role } from "../../../generated/prisma/enums";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ISendAssessmentInvitePayload } from "./assessmentInvite.interface";

const sendAssessmentInvites = async (
	payload: ISendAssessmentInvitePayload,
	user: { userId: string; role: Role },
) => {
	const assessment = await prisma.assessment.findUnique({
		where: { id: payload.assessmentId, isDeleted: false },
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
			"You can only invite candidates to your own assessments",
		);
	}

	if (!assessment.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot send invites for an inactive assessment",
		);
	}

	const uniqueEmails = Array.from(
		new Set(payload.emails.map((e) => e.trim().toLowerCase())),
	);

	const templatePath = path.join(
		process.cwd(),
		"src",
		"app",
		"templates",
		"assessment-invitation.ejs",
	);

	const results: Array<{
		email: string;
		status: "SENT" | "SKIPPED" | "EMAIL_FAILED";
		inviteId?: string;
		reason?: string;
	}> = [];

	for (const email of uniqueEmails) {
		let invite = await prisma.assessmentInvite.findUnique({
			where: {
				assessmentId_email: {
					assessmentId: payload.assessmentId,
					email,
				},
			},
		});

		const token = crypto.randomUUID();
		const expiresAt = payload.expiresAt
			? new Date(payload.expiresAt)
			: assessment.expiresAt || null;

		if (invite) {
			if (invite.status === InviteStatus.ACCEPTED) {
				results.push({
					email,
					status: "SKIPPED",
					reason: "Candidate has already accepted/attempted this assessment",
				});
				continue;
			}

			invite = await prisma.assessmentInvite.update({
				where: { id: invite.id },
				data: {
					token,
					status: InviteStatus.PENDING,
					sentAt: new Date(),
					expiresAt,
				},
			});
		} else {
			invite = await prisma.assessmentInvite.create({
				data: {
					assessmentId: payload.assessmentId,
					email,
					token,
					expiresAt,
					status: InviteStatus.PENDING,
				},
			});
		}

		const testLink = `${config.frontend_url}/assessment/take/${invite.token}`;
		const templateData = {
			companyName: assessment.recruiter.companyName || "Our Hiring Team",
			assessmentTitle: assessment.title,
			assessmentDescription: assessment.description,
			durationMinutes: assessment.durationMinutes,
			maxTabSwitches: assessment.maxTabSwitches,
			expiresAt: expiresAt ? expiresAt.toUTCString() : null,
			testLink,
		};

		try {
			const html = await ejs.renderFile(templatePath, templateData);
			await transporter.sendMail({
				from: config.email_sender,
				to: email,
				subject: `Invitation: Technical Assessment for ${assessment.title}`,
				html,
			});
			results.push({ email, status: "SENT", inviteId: invite.id });
		} catch (mailError) {
			console.error(`Failed to send email to ${email}:`, mailError);
			results.push({ email, status: "EMAIL_FAILED", inviteId: invite.id });
		}
	}

	return {
		assessmentId: payload.assessmentId,
		totalProcessed: results.length,
		details: results,
	};
};

const getInvitesByAssessmentId = async (
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
			"You can only view invites for your own assessments",
		);
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "sentAt";
	const sortOrder =
		(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";

	const andConditions: Prisma.AssessmentInviteWhereInput[] = [{ assessmentId }];

	if (query.status) {
		andConditions.push({ status: query.status as InviteStatus });
	}

	if (query.searchTerm) {
		andConditions.push({
			email: { contains: query.searchTerm, mode: "insensitive" },
		});
	}

	const [invites, total] = await Promise.all([
		prisma.assessmentInvite.findMany({
			where: { AND: andConditions },
			take: limit,
			skip: skip,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.assessmentInvite.count({ where: { AND: andConditions } }),
	]);

	return {
		data: invites,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const verifyInviteToken = async (token: string) => {
	const invite = await prisma.assessmentInvite.findUnique({
		where: { token },
		include: {
			assessment: {
				include: {
					recruiter: {
						select: {
							name: true,
							companyName: true,
							avatarUrl: true,
						},
					},
					_count: {
						select: {
							questions: true,
						},
					},
				},
			},
		},
	});

	if (!invite) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Invalid invitation token or link not found",
		);
	}

	if (invite.assessment.isDeleted || !invite.assessment.isActive) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This assessment is no longer active",
		);
	}

	const now = new Date();
	if (
		(invite.expiresAt && now > invite.expiresAt) ||
		(invite.assessment.expiresAt && now > invite.assessment.expiresAt)
	) {
		if (invite.status !== InviteStatus.EXPIRED) {
			await prisma.assessmentInvite.update({
				where: { id: invite.id },
				data: { status: InviteStatus.EXPIRED },
			});
		}
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This invitation link has expired",
		);
	}

	return {
		inviteId: invite.id,
		email: invite.email,
		status: invite.status,
		sentAt: invite.sentAt,
		expiresAt: invite.expiresAt,
		assessment: {
			id: invite.assessment.id,
			title: invite.assessment.title,
			description: invite.assessment.description,
			durationMinutes: invite.assessment.durationMinutes,
			passingScore: invite.assessment.passingScore,
			maxTabSwitches: invite.assessment.maxTabSwitches,
			totalQuestions: invite.assessment._count.questions,
			recruiter: invite.assessment.recruiter,
		},
	};
};

const resendAssessmentInvite = async (
	inviteId: string,
	user: { userId: string; role: Role },
) => {
	const invite = await prisma.assessmentInvite.findUnique({
		where: { id: inviteId },
		include: {
			assessment: {
				include: { recruiter: true },
			},
		},
	});

	if (!invite) {
		throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
	}

	if (
		user.role === Role.RECRUITER &&
		invite.assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only resend invites for your own assessments",
		);
	}

	const newToken = crypto.randomUUID();
	const updatedInvite = await prisma.assessmentInvite.update({
		where: { id: inviteId },
		data: {
			token: newToken,
			status: InviteStatus.PENDING,
			sentAt: new Date(),
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src",
		"app",
		"templates",
		"assessment-invitation.ejs",
	);

	const testLink = `${config.frontend_url}/assessment/take/${updatedInvite.token}`;
	const templateData = {
		companyName: invite.assessment.recruiter.companyName || "Our Hiring Team",
		assessmentTitle: invite.assessment.title,
		assessmentDescription: invite.assessment.description,
		durationMinutes: invite.assessment.durationMinutes,
		maxTabSwitches: invite.assessment.maxTabSwitches,
		expiresAt: updatedInvite.expiresAt
			? updatedInvite.expiresAt.toUTCString()
			: null,
		testLink,
	};

	const html = await ejs.renderFile(templatePath, templateData);
	await transporter.sendMail({
		from: config.email_sender,
		to: updatedInvite.email,
		subject: `Reminder: Technical Assessment Invitation for ${invite.assessment.title}`,
		html,
	});

	return updatedInvite;
};

const deleteAssessmentInvite = async (
	inviteId: string,
	user: { userId: string; role: Role },
) => {
	const invite = await prisma.assessmentInvite.findUnique({
		where: { id: inviteId },
		include: {
			assessment: {
				include: { recruiter: true },
			},
		},
	});

	if (!invite) {
		throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
	}

	if (
		user.role === Role.RECRUITER &&
		invite.assessment.recruiter.userId !== user.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only cancel invites for your own assessments",
		);
	}

	await prisma.assessmentInvite.delete({
		where: { id: inviteId },
	});

	return { message: "Invitation cancelled successfully" };
};

export const AssessmentInviteService = {
	sendAssessmentInvites,
	getInvitesByAssessmentId,
	verifyInviteToken,
	resendAssessmentInvite,
	deleteAssessmentInvite,
};
