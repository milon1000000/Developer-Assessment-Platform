import type { Difficulty, QuestionType } from "../../../generated/prisma/enums";

export interface ICreateGlobalQuestionPayload {
	title: string;
	type?: QuestionType;
	difficulty?: Difficulty;
	tags?: string[];
	problemStatement: string;
	constraints?: string;
	starterCode?: Record<string, any>;
	testCases?: Array<Record<string, any>>;
	mcqOptions?: string[];
	correctOption?: string;
}

export interface IUpdateGlobalQuestionPayload {
	title?: string;
	type?: QuestionType;
	difficulty?: Difficulty;
	tags?: string[];
	problemStatement?: string;
	constraints?: string;
	starterCode?: Record<string, any>;
	testCases?: Array<Record<string, any>>;
	mcqOptions?: string[];
	correctOption?: string;
	isActive?: boolean;
}

export interface IGlobalQuestionFilterableFields {
	searchTerm?: string;
	search?: string;
	title?: string;
	difficulty?: Difficulty;
	type?: QuestionType;
	tags?: string;
	isActive?: boolean | string;
}
