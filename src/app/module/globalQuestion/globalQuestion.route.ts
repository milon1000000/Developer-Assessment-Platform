import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { GlobalQuestionController } from "./globalQuestion.controller";
import { GlobalQuestionValidation } from "./globalQuestion.validation";

const router = Router();

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(GlobalQuestionValidation.CreateGlobalQuestionZodSchema),
	GlobalQuestionController.createGlobalQuestion,
);

router.get(
	"/",
	auth(Role.ADMIN, Role.RECRUITER),
	GlobalQuestionController.getAllGlobalQuestions,
);

router.get(
	"/:id",
	auth(Role.ADMIN, Role.RECRUITER),
	GlobalQuestionController.getGlobalQuestionById,
);

router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(GlobalQuestionValidation.UpdateGlobalQuestionZodSchema),
	GlobalQuestionController.updateGlobalQuestion,
);

router.delete(
	"/:id",
	auth(Role.ADMIN),
	GlobalQuestionController.deleteGlobalQuestion,
);

export const GlobalQuestionRoutes = router;
