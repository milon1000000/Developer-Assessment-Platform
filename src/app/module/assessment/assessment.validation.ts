import z from "zod";

const CreateAssessmentQuestionZodSchema = z.object({
	globalQuestionId: z.string().optional(),
	title: z.string().min(3).optional(),
	type: z.enum(["CODING", "MCQ"]).optional().default("CODING"),
	difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().default("EASY"),
	problemStatement: z.string().min(10).optional(),
	constraints: z.string().optional(),
	starterCode: z.any().optional(),
	testCases: z.any().optional(),
	mcqOptions: z.any().optional(),
	correctOption: z.string().optional(),
	points: z.number().min(1).optional().default(10),
	orderIndex: z.number().min(0).optional().default(0),
});

const CreateAssessmentZodSchema = z.object({
	title: z.string().min(3, "Title must be at least 3 characters long"),
	description: z.string().optional(),
	durationMinutes: z
		.number()
		.min(5, "Duration must be at least 5 minutes")
		.optional()
		.default(60),
	passingScore: z
		.number()
		.min(0, "Passing score cannot be negative")
		.max(100, "Passing score cannot exceed 100")
		.optional()
		.default(60),
	maxTabSwitches: z
		.number()
		.min(0, "Max tab switches cannot be negative")
		.optional()
		.default(3),
	expiresAt: z.string().optional(),
	questions: z.array(CreateAssessmentQuestionZodSchema).optional(),
});

const UpdateAssessmentZodSchema = z.object({
	title: z.string().min(3).optional(),
	description: z.string().optional(),
	durationMinutes: z
		.number()
		.min(5, "Duration must be at least 5 minutes")
		.optional(),
	passingScore: z.number().min(0).max(100).optional(),
	maxTabSwitches: z.number().min(0).optional(),
	expiresAt: z.string().optional(),
	isActive: z.boolean().optional(),
});

const AddQuestionsToAssessmentZodSchema = z.object({
	questions: z
		.array(CreateAssessmentQuestionZodSchema)
		.min(1, "At least one question is required"),
});

export const AssessmentValidation = {
	CreateAssessmentZodSchema,
	UpdateAssessmentZodSchema,
	AddQuestionsToAssessmentZodSchema,
};
