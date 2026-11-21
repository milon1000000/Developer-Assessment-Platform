import z from "zod";

const AuditLogQueryZodSchema = z.object({
	page: z.string().optional(),
	limit: z.string().optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
	action: z.string().optional(),
	entity: z.string().optional(),
	userId: z.string().optional(),
	searchTerm: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

export const AuditLogValidation = {
	AuditLogQueryZodSchema,
};
