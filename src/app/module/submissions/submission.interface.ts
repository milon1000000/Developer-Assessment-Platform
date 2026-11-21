import type {
	ProctorEventType,
	SubmissionStatus,
} from "../../../generated/prisma/enums";

export interface IStartAssessmentPayload {
	inviteToken?: string;
	assessmentId?: string;
}

export interface ISubmitAnswerPayload {
	questionId: string;
	selectedOption?: string;
	code?: string;
	submittedCode?: string;
	language?: string;
	passedTestCases?: number;
	totalTestCases?: number;
}

export interface IRunCodePayload {
	questionId: string;
	code: string;
	language?: string;
}

export interface IProctorEventPayload {
	eventType: ProctorEventType;
	details?: any;
}

export interface IReviewSubmissionPayload {
	feedback?: string;
	totalScore?: number;
}

export interface ISubmissionFilterableFields {
	status?: SubmissionStatus;
	isPassed?: boolean | string;
	searchTerm?: string;
}
