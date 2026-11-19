import z from "zod";

const SendAssessmentInviteZodSchema = z.object({
	assessmentId: z.string().min(1, "Assessment ID is required"),
	emails: z
		.array(z.string().email("Invalid email address"))
		.min(1, "At least one candidate email is required"),
	expiresAt: z.string().optional(),
});

export const AssessmentInviteValidation = {
	SendAssessmentInviteZodSchema,
};
