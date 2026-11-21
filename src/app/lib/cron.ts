import cron from "node-cron";
import {
	InviteStatus,
	QuestionType,
	SubmissionStatus,
} from "../../generated/prisma/enums";
import { prisma } from "./prisma";

/**
 * 1. Auto-expire Pending Assessment Invitations
 * Runs every 30 minutes
 * Marks invites older than 72 hours (or past their specific expiresAt) as EXPIRED
 */
export const autoExpireAssessmentInvites = () => {
	cron.schedule("*/30 * * * *", async () => {
		try {
			const now = new Date();
			const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

			const expiredInvites = await prisma.assessmentInvite.updateMany({
				where: {
					status: InviteStatus.PENDING,
					OR: [
						{ expiresAt: { lt: now } },
						{ sentAt: { lt: seventyTwoHoursAgo } },
					],
				},
				data: {
					status: InviteStatus.EXPIRED,
				},
			});

			if (expiredInvites.count > 0) {
				console.log(
					`[Cron Job] Marked ${expiredInvites.count} expired assessment invitation(s) as EXPIRED.`,
				);
			}
		} catch (error) {
			console.error("[Cron Job] Failed to auto-expire invites:", error);
		}
	});
};

/**
 * 2. Auto-submit and Grade Expired Ongoing Exams (Time Out)
 * Runs every 2 minutes
 * Finds submissions that are still IN_PROGRESS but exceeded durationMinutes + 2m grace period.
 * Automatically grades all answers, calculates percentage/score, and finalizes submission.
 */
export const autoSubmitExpiredExams = () => {
	cron.schedule("*/2 * * * *", async () => {
		try {
			const now = new Date();

			// Find in-progress submissions with assessment details
			const inProgressSubmissions = await prisma.submission.findMany({
				where: {
					status: SubmissionStatus.IN_PROGRESS,
				},
				include: {
					assessment: {
						include: {
							questions: true,
						},
					},
					answers: true,
				},
			});

			for (const submission of inProgressSubmissions) {
				const durationMinutes = submission.assessment.durationMinutes || 60;
				const gracePeriodMinutes = 2; // 2 minutes grace period for network buffers
				const expirationTime = new Date(
					new Date(submission.startedAt).getTime() +
						(durationMinutes + gracePeriodMinutes) * 60 * 1000,
				);

				if (now > expirationTime) {
					console.log(
						`[Cron Job] Auto-submitting timed out submission ID: ${submission.id}`,
					);

					let totalScore = 0;
					const questions = submission.assessment.questions;
					const answerMap = new Map(
						submission.answers.map((a) => [a.questionId, a]),
					);

					// Automated grading of completed answers
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
						} else if (q.type === QuestionType.CODING) {
							if (ans?.code && ans.code.trim().length > 10) {
								score = q.points || 10;
							}
						}

						totalScore += score;

						if (ans) {
							await prisma.answer.update({
								where: { id: ans.id },
								data: { scoreEarned: score },
							});
						}
					}

					const maxScore =
						submission.maxScore > 0
							? submission.maxScore
							: questions.reduce((acc, q) => acc + (q.points || 10), 0);

					const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
					const isPassed =
						percentage >= (submission.assessment.passingScore || 60);
					const timeSpentSeconds = durationMinutes * 60;

					await prisma.submission.update({
						where: { id: submission.id },
						data: {
							status: SubmissionStatus.SUBMITTED,
							totalScore,
							percentage: Math.round(percentage * 100) / 100,
							isPassed,
							submittedAt: now,
							timeSpentSeconds,
							feedback:
								"Auto-submitted and graded by background scheduler due to exam time limit expiration.",
						},
					});

					console.log(
						`[Cron Job] Successfully finalized timed-out submission: ${submission.id} (Score: ${totalScore}/${maxScore})`,
					);
				}
			}
		} catch (error) {
			console.error("[Cron Job] Failed to auto-submit expired exams:", error);
		}
	});
};

/**
 * Initialize all cron jobs
 */
export const initCronJobs = () => {
	autoExpireAssessmentInvites();
	autoSubmitExpiredExams();
	console.log("[Cron Job] Background schedulers initialized successfully.");
};
