import z from "zod";

const DashboardQueryZodSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

export const DashboardValidation = {
	DashboardQueryZodSchema,
};
