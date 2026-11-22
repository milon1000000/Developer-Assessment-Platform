import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SubmissionController } from "./submission.controller";
import { SubmissionValidation } from "./submission.validation";

const router = Router();

// Developer starts or resumes an assessment session
router.post(
	"/start",
	auth(Role.DEVELOPER),
	validateRequest(SubmissionValidation.StartAssessmentZodSchema),
	SubmissionController.startAssessment,
);

// Developer saves/updates an answer for a specific question (Draft or intermediate submission)
router.post(
	"/:id/answer",
	auth(Role.DEVELOPER),
	validateRequest(SubmissionValidation.SubmitAnswerZodSchema),
	SubmissionController.saveAnswer,
);

// Developer executes code against sample test cases in sandbox
router.post(
	"/:id/run-code",
	auth(Role.DEVELOPER),
	validateRequest(SubmissionValidation.RunCodeZodSchema),
	SubmissionController.runCode,
);

// Developer records a proctoring event (e.g. tab switch, copy paste)
router.post(
	"/:id/proctor-event",
	auth(Role.DEVELOPER),
	validateRequest(SubmissionValidation.ProctorEventZodSchema),
	SubmissionController.recordProctorEvent,
);

// Developer finalizes and submits exam (triggers automated grading)
router.post(
	"/:id/submit",
	auth(Role.DEVELOPER),
	SubmissionController.submitExam,
);

// Developer views all their past and ongoing submissions
router.get(
	"/my-submissions",
	auth(Role.DEVELOPER),
	SubmissionController.getMySubmissions,
);

// Recruiter/Admin views all candidate submissions for a specific assessment
router.get(
	"/assessment/:assessmentId",
	auth(Role.RECRUITER, Role.ADMIN),
	SubmissionController.getSubmissionsByAssessment,
);

// View single submission scorecard, answers, and proctor logs
router.get(
	"/:id",
	auth(Role.DEVELOPER, Role.RECRUITER, Role.ADMIN),
	SubmissionController.getSubmissionById,
);

// Recruiter/Admin reviews and adds feedback/score adjustments to a submission
router.patch(
	"/:id/review",
	auth(Role.RECRUITER, Role.ADMIN),
	validateRequest(SubmissionValidation.ReviewSubmissionZodSchema),
	SubmissionController.reviewSubmission,
);

export const SubmissionRoutes = router;
