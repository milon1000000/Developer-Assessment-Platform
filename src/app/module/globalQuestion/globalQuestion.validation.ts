import z from "zod";

const CreateGlobalQuestionZodSchema = z.object({
	title: z.string().min(3, "Title must be at least 3 characters long"),
	type: z.enum(["CODING", "MCQ"]).optional().default("CODING"),
	difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().default("EASY"),
	tags: z.array(z.string()).optional().default([]),
	problemStatement: z
		.string()
		.min(10, "Problem statement must be at least 10 characters long"),
	constraints: z.string().optional(),
	starterCode: z.any().optional(),
	testCases: z.any().optional(),
	mcqOptions: z.any().optional(),
	correctOption: z.string().optional(),
});

const UpdateGlobalQuestionZodSchema = z.object({
	title: z.string().min(3).optional(),
	type: z.enum(["CODING", "MCQ"]).optional(),
	difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
	tags: z.array(z.string()).optional(),
	problemStatement: z.string().min(10).optional(),
	constraints: z.string().optional(),
	starterCode: z.any().optional(),
	testCases: z.any().optional(),
	mcqOptions: z.any().optional(),
	correctOption: z.string().optional(),
	isActive: z.boolean().optional(),
});

export const GlobalQuestionValidation = {
	CreateGlobalQuestionZodSchema,
	UpdateGlobalQuestionZodSchema,
};
