import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AssessmentController } from "./assessment.controller";
import { AssessmentValidation } from "./assessment.validation";

const router = Router();

// Create new assessment (Recruiter / Admin)
router.post(
	"/",
	auth(Role.RECRUITER),
	validateRequest(AssessmentValidation.CreateAssessmentZodSchema),
	AssessmentController.createAssessment,
);

// Get all assessments (Recruiter gets their own; Admin sees all)
router.get(
	"/",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentController.getAllAssessments,
);

// Candidate preview/access assessment by public invite token
router.get(
	"/token/:inviteToken",
	AssessmentController.getAssessmentByInviteToken,
);

// Get single assessment details by ID
router.get(
	"/:id",
	auth(Role.RECRUITER, Role.ADMIN, Role.DEVELOPER),
	AssessmentController.getAssessmentById,
);

// Update assessment metadata
router.patch(
	"/:id",
	auth(Role.RECRUITER, Role.ADMIN),
	validateRequest(AssessmentValidation.UpdateAssessmentZodSchema),
	AssessmentController.updateAssessment,
);

// Delete assessment (Soft delete)
router.delete(
	"/:id",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentController.deleteAssessment,
);

// Add questions to an existing assessment
router.post(
	"/:id/questions",
	auth(Role.RECRUITER, Role.ADMIN),
	validateRequest(AssessmentValidation.AddQuestionsToAssessmentZodSchema),
	AssessmentController.addQuestionsToAssessment,
);

// Remove a question from an assessment
router.delete(
	"/:id/questions/:questionId",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentController.removeQuestionFromAssessment,
);

export const AssessmentRoutes = router;
