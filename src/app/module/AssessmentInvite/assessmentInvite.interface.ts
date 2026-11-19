import type { InviteStatus } from "../../../generated/prisma/enums";

export interface ISendAssessmentInvitePayload {
	assessmentId: string;
	emails: string[];
	expiresAt?: string | Date;
}

export interface IAssessmentInviteFilterableFields {
	searchTerm?: string;
	status?: InviteStatus;
	email?: string;
	assessmentId?: string;
}
