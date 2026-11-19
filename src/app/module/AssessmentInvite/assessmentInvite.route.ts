import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AssessmentInviteController } from "./assessmentInvite.controller";
import { AssessmentInviteValidation } from "./assessmentInvite.validation";

const router = Router();

// Send invitations to one or multiple candidates (Recruiter / Admin)
router.post(
	"/",
	auth(Role.RECRUITER, Role.ADMIN),
	validateRequest(AssessmentInviteValidation.SendAssessmentInviteZodSchema),
	AssessmentInviteController.sendAssessmentInvites,
);

// Get all invitations for a specific assessment
router.get(
	"/assessment/:assessmentId",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentInviteController.getInvitesByAssessmentId,
);

// Verify candidate invitation link by token (Public / Candidate)
router.get("/verify/:token", AssessmentInviteController.verifyInviteToken);

// Resend invitation email
router.post(
	"/:id/resend",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentInviteController.resendAssessmentInvite,
);

// Cancel/Delete invitation
router.delete(
	"/:id",
	auth(Role.RECRUITER, Role.ADMIN),
	AssessmentInviteController.deleteAssessmentInvite,
);

export const AssessmentInviteRoutes = router;
