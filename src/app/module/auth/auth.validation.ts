import z from "zod";

const DeveloperRegistrationZodSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 2 characters long")
		.max(50, "Name cannot exceed 50 characters"),
	email: z.string().email("Invalid email format"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters long")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
	phone: z.string().optional(),
	avatarUrl: z.string().url().optional(),
	skills: z.array(z.string()).optional(),
	experienceYears: z.number().min(0).optional(),
	githubUrl: z.string().url().optional(),
	portfolioUrl: z.string().url().optional(),
	resumeUrl: z.string().url().optional(),
});

const UpdateDeveloperProfileZodSchema = z.object({
	name: z.string().min(2).max(50).optional(),
	phone: z.string().optional(),
	avatarUrl: z.string().optional(),
	skills: z.union([z.array(z.string()), z.string()]).optional(),
	experienceYears: z
		.union([z.number(), z.string().transform((v) => Number(v))])
		.optional(),
	githubUrl: z.string().optional(),
	portfolioUrl: z.string().optional(),
	resumeUrl: z.string().optional(),
});

const VerifyEmailZodSchema = z.object({
	email: z.string().email("Invalid email format"),
	otp: z.string().length(6, "OTP must be 6 digits"),
});

const LoginZodSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(1, "Password is required"),
});

const ForgotZodSchema = z.object({
	email: z.string().email("Invalid email format"),
});

const ResetZodSchema = z.object({
	email: z.string().email("Invalid email format"),
	newPassword: z
		.string()
		.min(8, "Password must be at least 8 characters long")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
	otp: z.string().length(6, "OTP must be 6 digits"),
});

export const UserValidation = {
	DeveloperRegistrationZodSchema,
	UpdateDeveloperProfileZodSchema,
	VerifyEmailZodSchema,
	LoginZodSchema,
	ForgotZodSchema,
	ResetZodSchema,
};
