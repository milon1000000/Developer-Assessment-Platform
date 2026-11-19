import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { DashboardController } from "./dashboard.controller";

const router = Router();

// Admin platform analytics overview
router.get("/admin", auth(Role.ADMIN), DashboardController.getAdminDashboard);

// Recruiter company assessments & candidates overview
router.get(
	"/recruiter",
	auth(Role.RECRUITER, Role.ADMIN),
	DashboardController.getRecruiterDashboard,
);

// Developer personal assessment statistics & performance overview
router.get(
	"/developer",
	auth(Role.DEVELOPER, Role.ADMIN),
	DashboardController.getDeveloperDashboard,
);

export const DashboardRoutes = router;
