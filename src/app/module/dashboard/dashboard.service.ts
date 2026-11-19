import httpStatus from "http-status";
import {
	InviteStatus,
	Role,
	SubmissionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAdminDashboardOverview,
	IDeveloperDashboardOverview,
	IRecruiterDashboardOverview,
} from "./dashboard.interface";

const getAdminDashboard = async (): Promise<IAdminDashboardOverview> => {
	const [
		totalUsers,
		totalDevelopers,
		totalRecruiters,
		totalAssessments,
		totalQuestions,
		totalInvites,
		totalSubmissions,
		completedSubmissions,
		passedSubmissions,
		disqualifiedSubmissions,
		recentSubmissions,
		recentAssessments,
		recentUsers,
	] = await Promise.all([
		prisma.user.count({ where: { isDeleted: false } }),
		prisma.user.count({
			where: { role: Role.DEVELOPER, isDeleted: false },
		}),
		prisma.user.count({
			where: { role: Role.RECRUITER, isDeleted: false },
		}),
		prisma.assessment.count({ where: { isDeleted: false } }),
		prisma.globalQuestion.count({ where: { isDeleted: false } }),
		prisma.assessmentInvite.count(),
		prisma.submission.count(),
		prisma.submission.count({
			where: { status: SubmissionStatus.SUBMITTED },
		}),
		prisma.submission.count({
			where: { status: SubmissionStatus.SUBMITTED, isPassed: true },
		}),
		prisma.submission.count({
			where: { status: SubmissionStatus.DISQUALIFIED },
		}),
		prisma.submission.findMany({
			take: 5,
			orderBy: { startedAt: "desc" },
			include: {
				developer: {
					include: {
						user: { select: { email: true } },
					},
				},
				assessment: {
					select: { title: true },
				},
			},
		}),
		prisma.assessment.findMany({
			where: { isDeleted: false },
			take: 5,
			orderBy: { createdAt: "desc" },
			include: {
				recruiter: {
					select: { name: true, companyName: true },
				},
				_count: {
					select: { questions: true, submissions: true },
				},
			},
		}),
		prisma.user.findMany({
			where: { isDeleted: false },
			take: 5,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				createdAt: true,
			},
		}),
	]);

	const overallPassRate =
		completedSubmissions > 0
			? Math.round((passedSubmissions / completedSubmissions) * 100 * 10) / 10
			: 0;

	return {
		counts: {
			totalUsers,
			totalDevelopers,
			totalRecruiters,
			totalAssessments,
			totalQuestions,
			totalInvites,
			totalSubmissions,
			completedSubmissions,
			passedSubmissions,
			disqualifiedSubmissions,
			overallPassRate,
		},
		recentActivity: {
			recentSubmissions,
			recentAssessments,
			recentUsers,
		},
	};
};

const getRecruiterDashboard = async (
	userId: string,
): Promise<IRecruiterDashboardOverview> => {
	const recruiter = await prisma.recruiter.findUnique({
		where: { userId },
	});

	if (!recruiter) {
		throw new AppError(httpStatus.NOT_FOUND, "Recruiter profile not found");
	}

	const assessments = await prisma.assessment.findMany({
		where: { recruiterId: recruiter.id, isDeleted: false },
		select: { id: true, title: true, isActive: true },
	});

	const assessmentIds = assessments.map((a) => a.id);

	if (assessmentIds.length === 0) {
		return {
			counts: {
				totalAssessments: 0,
				activeAssessments: 0,
				totalInvites: 0,
				pendingInvites: 0,
				acceptedInvites: 0,
				totalSubmissions: 0,
				completedSubmissions: 0,
				passedCandidates: 0,
				failedCandidates: 0,
				disqualifiedCandidates: 0,
				passRate: 0,
				averageScore: 0,
			},
			recentSubmissions: [],
			topAssessments: [],
		};
	}

	const [
		totalInvites,
		pendingInvites,
		acceptedInvites,
		totalSubmissions,
		completedSubmissions,
		passedCandidates,
		disqualifiedCandidates,
		avgScoreResult,
		recentSubmissions,
		topAssessments,
	] = await Promise.all([
		prisma.assessmentInvite.count({
			where: { assessmentId: { in: assessmentIds } },
		}),
		prisma.assessmentInvite.count({
			where: {
				assessmentId: { in: assessmentIds },
				status: InviteStatus.PENDING,
			},
		}),
		prisma.assessmentInvite.count({
			where: {
				assessmentId: { in: assessmentIds },
				status: InviteStatus.ACCEPTED,
			},
		}),
		prisma.submission.count({
			where: { assessmentId: { in: assessmentIds } },
		}),
		prisma.submission.count({
			where: {
				assessmentId: { in: assessmentIds },
				status: SubmissionStatus.SUBMITTED,
			},
		}),
		prisma.submission.count({
			where: {
				assessmentId: { in: assessmentIds },
				isPassed: true,
			},
		}),
		prisma.submission.count({
			where: {
				assessmentId: { in: assessmentIds },
				status: SubmissionStatus.DISQUALIFIED,
			},
		}),
		prisma.submission.aggregate({
			where: {
				assessmentId: { in: assessmentIds },
				status: SubmissionStatus.SUBMITTED,
			},
			_avg: { percentage: true },
		}),
		prisma.submission.findMany({
			where: { assessmentId: { in: assessmentIds } },
			take: 5,
			orderBy: { startedAt: "desc" },
			include: {
				developer: {
					include: {
						user: { select: { email: true } },
					},
				},
				assessment: {
					select: { title: true },
				},
			},
		}),
		prisma.assessment.findMany({
			where: { id: { in: assessmentIds } },
			take: 5,
			include: {
				_count: {
					select: {
						submissions: true,
						questions: true,
						invites: true,
					},
				},
			},
			orderBy: {
				submissions: {
					_count: "desc",
				},
			},
		}),
	]);

	const failedCandidates = Math.max(0, completedSubmissions - passedCandidates);
	const passRate =
		completedSubmissions > 0
			? Math.round((passedCandidates / completedSubmissions) * 100 * 10) / 10
			: 0;

	const averageScore =
		Math.round((avgScoreResult._avg.percentage || 0) * 10) / 10;

	return {
		counts: {
			totalAssessments: assessments.length,
			activeAssessments: assessments.filter((a) => a.isActive).length,
			totalInvites,
			pendingInvites,
			acceptedInvites,
			totalSubmissions,
			completedSubmissions,
			passedCandidates,
			failedCandidates,
			disqualifiedCandidates,
			passRate,
			averageScore,
		},
		recentSubmissions,
		topAssessments,
	};
};

const getDeveloperDashboard = async (
	userId: string,
): Promise<IDeveloperDashboardOverview> => {
	const developer = await prisma.developer.findUnique({
		where: { userId },
	});

	if (!developer) {
		return {
			counts: {
				totalAttempted: 0,
				completed: 0,
				passed: 0,
				failed: 0,
				inProgress: 0,
				passRate: 0,
				averageScore: 0,
			},
			recentSubmissions: [],
		};
	}

	const [
		totalAttempted,
		completed,
		passed,
		inProgress,
		avgScoreResult,
		recentSubmissions,
	] = await Promise.all([
		prisma.submission.count({ where: { developerId: developer.id } }),
		prisma.submission.count({
			where: {
				developerId: developer.id,
				status: SubmissionStatus.SUBMITTED,
			},
		}),
		prisma.submission.count({
			where: {
				developerId: developer.id,
				isPassed: true,
			},
		}),
		prisma.submission.count({
			where: {
				developerId: developer.id,
				status: SubmissionStatus.IN_PROGRESS,
			},
		}),
		prisma.submission.aggregate({
			where: {
				developerId: developer.id,
				status: SubmissionStatus.SUBMITTED,
			},
			_avg: { percentage: true },
		}),
		prisma.submission.findMany({
			where: { developerId: developer.id },
			take: 5,
			orderBy: { startedAt: "desc" },
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
	]);

	const failed = Math.max(0, completed - passed);
	const passRate =
		completed > 0 ? Math.round((passed / completed) * 100 * 10) / 10 : 0;
	const averageScore =
		Math.round((avgScoreResult._avg.percentage || 0) * 10) / 10;

	return {
		counts: {
			totalAttempted,
			completed,
			passed,
			failed,
			inProgress,
			passRate,
			averageScore,
		},
		recentSubmissions,
	};
};

export const DashboardService = {
	getAdminDashboard,
	getRecruiterDashboard,
	getDeveloperDashboard,
};
