import type {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";

export interface IUpdateRecruiterProfilePayload {
	name?: string;
	companyName?: string;
	companyWebsite?: string;
	designation?: string;
	phone?: string;
	avatarUrl?: string;
	buffer?: Buffer;
}

export interface IUpdateAdminProfilePayload {
	name?: string;
	phone?: string;
	avatarUrl?: string;
	buffer?: Buffer;
}

export interface IChangeUserStatusPayload {
	status: UserStatus;
}

export interface IUserFilterableFields {
	searchTerm?: string;
	role?: Role;
	status?: UserStatus;
	authProvider?: AuthProvider;
}
