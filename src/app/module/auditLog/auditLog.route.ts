import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuditLogController } from "./auditLog.controller";

const router = Router();

// Stats summary route (placed before /:id)
router.get("/stats", auth(Role.ADMIN), AuditLogController.getAuditStats);

// Get all audit logs with search, filter, pagination
router.get("/", auth(Role.ADMIN), AuditLogController.getAllAuditLogs);

// Get single audit log details by ID
router.get("/:id", auth(Role.ADMIN), AuditLogController.getAuditLogById);

export const AuditLogRoutes = router;
