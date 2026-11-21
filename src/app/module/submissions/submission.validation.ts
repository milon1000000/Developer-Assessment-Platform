import z from "zod";

const StartAssessmentZodSchema = z
	.object({
		inviteToken: z.string().optional(),
		assessmentId: z.string().optional(),
	})
	.refine((data) => data.inviteToken || data.assessmentId, {
		message: "Either inviteToken or assessmentId must be provided",
	});

const SubmitAnswerZodSchema = z.object({
	questionId: z.string().min(1, "Question ID is required"),
	selectedOption: z.string().optional(),
	code: z.string().optional(),
	submittedCode: z.string().optional(),
	language: z.string().optional(),
	passedTestCases: z.number().optional(),
	totalTestCases: z.number().optional(),
});

const ProctorEventZodSchema = z.object({
	eventType: z.enum([
		"TAB_SWITCH",
		"COPY_PASTE",
		"WINDOW_BLUR",
		"FULLSCREEN_EXIT",
	]),
	details: z.any().optional(),
});

const ReviewSubmissionZodSchema = z.object({
	feedback: z.string().optional(),
	totalScore: z.number().min(0).optional(),
});

const RunCodeZodSchema = z.object({
	questionId: z.string().min(1, "Question ID is required"),
	code: z.string().min(1, "Code is required"),
	language: z.string().optional(),
});

export const SubmissionValidation = {
	StartAssessmentZodSchema,
	SubmitAnswerZodSchema,
	RunCodeZodSchema,
	ProctorEventZodSchema,
	ReviewSubmissionZodSchema,
};
