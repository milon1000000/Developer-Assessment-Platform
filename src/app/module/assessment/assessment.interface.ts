import type { Difficulty, QuestionType } from "../../../generated/prisma/enums";

export interface IAssessmentQuestionItem {
	globalQuestionId?: string;
	title?: string;
	type?: QuestionType;
	difficulty?: Difficulty;
	problemStatement?: string;
	constraints?: string;
	starterCode?: Record<string, any>;
	testCases?: Array<Record<string, any>>;
	mcqOptions?: any;
	correctOption?: string;
	points?: number;
	orderIndex?: number;
}

export interface ICreateAssessmentPayload {
	title: string;
	description?: string;
	durationMinutes?: number;
	passingScore?: number;
	maxTabSwitches?: number;
	expiresAt?: string | Date;
	questions?: IAssessmentQuestionItem[];
}

export interface IUpdateAssessmentPayload {
	title?: string;
	description?: string;
	durationMinutes?: number;
	passingScore?: number;
	maxTabSwitches?: number;
	expiresAt?: string | Date;
	isActive?: boolean;
}

export interface IAddQuestionsToAssessmentPayload {
	questions: IAssessmentQuestionItem[];
}

export interface IAssessmentFilterableFields {
	searchTerm?: string;
	search?: string;
	title?: string;
	isActive?: boolean | string;
	recruiterId?: string;
}
