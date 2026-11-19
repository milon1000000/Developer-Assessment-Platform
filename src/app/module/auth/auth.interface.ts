export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterDeveloperPayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	avatarUrl?: string;
	skills?: string[];
	experienceYears?: number;
	githubUrl?: string;
	portfolioUrl?: string;
	resumeUrl?: string;
}

export interface IUpdateDeveloperProfilePayload {
	name?: string;
	phone?: string;
	avatarUrl?: string;
	skills?: string[];
	experienceYears?: number;
	githubUrl?: string;
	portfolioUrl?: string;
	resumeUrl?: string;
	buffer?: Buffer;
}

export interface IVerifyEmailPayload {
	email: string;
	otp: string;
}

export interface IRegisterRecruiterPayload {
	name: string;
	email: string;
	companyName: string;
	companyWebsite?: string | null;
	designation?: string | null;
	phone?: string | null;
}

export interface IVerifyRecruiterEmailPayload {
	email: string;
	otp: string;
}

export interface IGoogleLoginPayload {
	idToken: string;
}

export interface IForgotPasswordPayload {
	email: string;
}

export interface IResetPasswordPayload {
	email: string;
	newPassword: string;
	otp: string;
}

export interface IChangePasswordPayload {
	oldPassword: string;
	newPassword: string;
}
