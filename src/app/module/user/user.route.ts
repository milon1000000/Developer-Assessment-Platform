import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

// Recruiter profile endpoints
router.get(
	"/recruiter/profile",
	auth(Role.RECRUITER, Role.ADMIN),
	UserController.getRecruiterProfile,
);

router.patch(
	"/recruiter/profile",
	auth(Role.RECRUITER, Role.ADMIN),
	upload.single("image"),
	validateRequest(UserValidation.UpdateRecruiterProfileZodSchema),
	UserController.updateRecruiterProfile,
);

// Admin profile endpoints
router.get("/admin/profile", auth(Role.ADMIN), UserController.getAdminProfile);

router.patch(
	"/admin/profile",
	auth(Role.ADMIN),
	upload.single("image"),
	validateRequest(UserValidation.UpdateAdminProfileZodSchema),
	UserController.updateAdminProfile,
);

// Admin user management endpoints
router.get("/all-users", auth(Role.ADMIN), UserController.getAllUsers);

router.get("/:id", auth(Role.ADMIN), UserController.getUserById);

router.patch(
	"/status/:id",
	auth(Role.ADMIN),
	validateRequest(UserValidation.ChangeUserStatusZodSchema),
	UserController.changeUserStatus,
);

router.delete("/:id", auth(Role.ADMIN), UserController.deleteUser);

export const UserRoutes = router;
