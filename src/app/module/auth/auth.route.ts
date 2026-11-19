import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";
import passport from "passport";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";

const router = Router();

router.post(
	"/register",
	validateRequest(UserValidation.DeveloperRegistrationZodSchema),
	AuthController.registerDeveloper,
);

router.post(
	"/verify-email",
	validateRequest(UserValidation.VerifyEmailZodSchema),
	AuthController.verifyDeveloperEmail,
);

router.post(
	"/register-recruiter",
	validateRequest(UserValidation.RecruiterRegistrationZodSchema),
	AuthController.registerRecruiter,
);

router.post(
	"/verify-recruiter-email",
	validateRequest(UserValidation.VerifyRecruiterEmailZodSchema),
	AuthController.verifyRecruiterEmail,
);

router.post(
	"/login",
	validateRequest(UserValidation.LoginZodSchema),
	AuthController.loginUser,
);

router.post("/refresh-token", AuthController.refreshToken);

router.get(
	"/google",
	passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get("/google/callback", AuthController.googleCallback);

router.get("/me", auth(), AuthController.getMe);

router.patch(
	"/profile",
	auth(Role.DEVELOPER),
	upload.single("image"),
	validateRequest(UserValidation.UpdateDeveloperProfileZodSchema),
	AuthController.updateProfile,
);

router.post(
	"/forgot-password",
	validateRequest(UserValidation.ForgotZodSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
	validateRequest(UserValidation.ResetZodSchema),
	AuthController.resetPassword,
);

router.post("/logout", AuthController.logout);

export const AuthRoutes = router;
