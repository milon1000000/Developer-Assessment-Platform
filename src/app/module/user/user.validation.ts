import z from "zod";

const UpdateRecruiterProfileZodSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").optional(),
	companyName: z
		.string()
		.min(2, "Company name must be at least 2 characters")
		.optional(),
	companyWebsite: z.string().optional(),
	designation: z.string().optional(),
	phone: z.string().optional(),
	avatarUrl: z.string().optional(),
});

const UpdateAdminProfileZodSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").optional(),
	phone: z.string().optional(),
	avatarUrl: z.string().optional(),
});

const ChangeUserStatusZodSchema = z.object({
	status: z.enum(["ACTIVE", "PENDING", "SUSPENDED"]),
});

export const UserValidation = {
	UpdateRecruiterProfileZodSchema,
	UpdateAdminProfileZodSchema,
	ChangeUserStatusZodSchema,
};
