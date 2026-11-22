import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IChangePasswordPayload,
	IForgotPasswordPayload,
	ILoginUserPayload,
	IRegisterDeveloperPayload,
	IRegisterRecruiterPayload,
	IUpdateDeveloperProfilePayload,
	IVerifyEmailPayload,
	IVerifyRecruiterEmailPayload,
} from "./auth.interface";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import { cloudinary } from "../../lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";
import ejs from "ejs";
import path from "path";
import { AppError } from "../../utils/AppError";

// 1. Register Developer (Sends Verification OTP)
const registerDeveloper = async (payload: IRegisterDeveloperPayload) => {
	const email = payload.email.trim().toLowerCase();
	const name = payload.name.trim();
	const password = payload.password;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	// Extract developer profile details
	const developerData = {
		name,
		phone: payload.phone || null,
		avatarUrl: payload.avatarUrl || null,
		skills: payload.skills || [],
		experienceYears: payload.experienceYears ?? 0,
		githubUrl: payload.githubUrl || null,
		portfolioUrl: payload.portfolioUrl || null,
		resumeUrl: payload.resumeUrl || null,
	};

	const otpKey = `developer-registration-otp:${email}`;
	const expirationSecound = 5 * 60;
	const otpValue = crypto.randomInt(100000, 900000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSecound,
		},
	});

	const registrationKey = `developer-registration-data:${email}`;
	const redisPayloadData = {
		name,
		email,
		password: hashedPassword,
		developerData,
	};

	await redisClient.set(registrationKey, JSON.stringify(redisPayloadData), {
		expiration: {
			type: "EX",
			value: expirationSecound,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);

	try {
		const templateData = {
			name,
			otpValue,
			expireMinites: expirationSecound / 60,
		};

		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Verify Your Email - Developer Assessment Platform",
			html,
		});
	} catch (mailError) {
		console.error("Error sending registration OTP email:", mailError);
	}
};

// 2. Verify Developer Email & Create Account
const verifyDeveloperEmail = async (payload: IVerifyEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const otpKey = `developer-registration-otp:${email}`;
	const redisOTP = await redisClient.get(otpKey);

	if (!redisOTP) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
	}
	if (redisOTP !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	await redisClient.del(otpKey);

	const registrationKey = `developer-registration-data:${email}`;
	const redisRegistrationData = await redisClient.get(registrationKey);

	if (!redisRegistrationData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration session expired. Please register again.",
		);
	}

	const devRegistration = JSON.parse(redisRegistrationData);
	const devDetails = devRegistration.developerData;

	// Create User with Developer Profile
	const createdUser = await prisma.user.create({
		data: {
			email: devRegistration.email,
			password: devRegistration.password,
			role: Role.DEVELOPER,
			status: UserStatus.ACTIVE,
			authProvider: AuthProvider.CREDENTIALS,
			emailVerified: true,
			developerProfile: {
				create: {
					name: devDetails.name || devRegistration.name,
					phone: devDetails.phone || null,
					avatarUrl: devDetails.avatarUrl || null,
					skills: devDetails.skills || [],
					experienceYears: Number(devDetails.experienceYears) || 0,
					githubUrl: devDetails.githubUrl || null,
					portfolioUrl: devDetails.portfolioUrl || null,
					resumeUrl: devDetails.resumeUrl || null,
				},
			},
		},
		omit: { password: true },
		include: { developerProfile: true },
	});

	await redisClient.del(registrationKey);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/developer-welcome-email.ejs",
	);

	const displayName =
		createdUser.developerProfile?.name || devRegistration.name;

	try {
		const templateData = {
			name: displayName,
		};

		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Welcome to Developer Assessment Platform",
			html,
		});
	} catch (mailError) {
		console.error("Error sending welcome email:", mailError);
	}

	const { developerProfile, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: displayName,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		developerProfile,
		accessToken,
		refreshToken,
	};
};

// 2.1. Register Recruiter (Stores in Redis and sends Verification OTP)
const registerRecruiter = async (payload: IRegisterRecruiterPayload) => {
	const email = payload.email.trim().toLowerCase();
	const name = payload.name.trim();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const otpKey = `recruiter-registration-otp:${email}`;
	const expirationSeconds = 15 * 60; // 15 minutes
	const otpValue = crypto.randomInt(100000, 900000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const registrationKey = `recruiter-registration-data:${email}`;
	const redisPayloadData = {
		name,
		email,
		companyName: payload.companyName.trim(),
		companyWebsite: payload.companyWebsite || null,
		designation: payload.designation || null,
		phone: payload.phone || null,
	};

	await redisClient.set(registrationKey, JSON.stringify(redisPayloadData), {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/recruiter-registration-otp.ejs",
	);

	try {
		const templateData = {
			name,
			companyName: payload.companyName,
			otpValue,
			expireMinutes: expirationSeconds / 60,
		};

		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Verify Your Email - Recruiter Application",
			html,
		});
	} catch (mailError) {
		console.error("Error sending recruiter registration OTP email:", mailError);
	}

	return {
		message:
			"Verification OTP has been sent to your email. Please verify within 15 minutes.",
	};
};

// 2.2. Verify Recruiter Email & Save to DB with PENDING status
const verifyRecruiterEmail = async (payload: IVerifyRecruiterEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const otpKey = `recruiter-registration-otp:${email}`;
	const redisOTP = await redisClient.get(otpKey);

	if (!redisOTP) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
	}
	if (redisOTP !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	await redisClient.del(otpKey);

	const registrationKey = `recruiter-registration-data:${email}`;
	const redisRegistrationData = await redisClient.get(registrationKey);

	if (!redisRegistrationData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration session expired. Please apply again.",
		);
	}

	const recruiterData = JSON.parse(redisRegistrationData);

	// Generate a secure placeholder hash until admin approves and assigns the real auto-generated password
	const temporaryPlaceholderHash = await bcrypt.hash(crypto.randomUUID(), 10);

	// Create User with Recruiter Profile in PENDING status
	const createdUser = await prisma.user.create({
		data: {
			email: recruiterData.email,
			password: temporaryPlaceholderHash,
			role: Role.RECRUITER,
			status: UserStatus.PENDING,
			authProvider: AuthProvider.CREDENTIALS,
			emailVerified: true,
			recruiterProfile: {
				create: {
					name: recruiterData.name,
					companyName: recruiterData.companyName,
					companyWebsite: recruiterData.companyWebsite || null,
					designation: recruiterData.designation || null,
					phone: recruiterData.phone || null,
					isVerified: false,
				},
			},
		},
		include: {
			recruiterProfile: true,
		},
	});

	await redisClient.del(registrationKey);

	return {
		id: createdUser.id,
		email: createdUser.email,
		role: createdUser.role,
		status: createdUser.status,
		companyName: createdUser.recruiterProfile?.companyName,
		message:
			"Email verified successfully! Your application has been submitted and is currently pending admin review and approval.",
	};
};

// 3. Login User
const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
		include: {
			developerProfile: true,
			recruiterProfile: true,
			adminProfile: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been suspended");
	}

	if (user.status === UserStatus.PENDING) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your recruiter account application is currently pending admin approval. You will receive an email once approved.",
		);
	}

	if (user.isDeleted) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted");
	}

	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Your email is not verified. Please verify your email.",
		);
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account was registered with Google. Please login using Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const displayName =
		user.developerProfile?.name ||
		user.recruiterProfile?.name ||
		user.adminProfile?.name ||
		"User";

	const jwtPayload = {
		userId: user.id,
		name: displayName,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	const profile =
		user.developerProfile || user.recruiterProfile || user.adminProfile || null;

	return {
		user: {
			id: user.id,
			email: user.email,
			role: user.role,
			status: user.status,
			authProvider: user.authProvider,
			hasPassword: Boolean(user.password),
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
		profile,
		accessToken,
		refreshToken,
	};
};

// 4. Refresh Token
const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? (verifiedRefreshToken.error as string)
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
		include: {
			developerProfile: true,
			recruiterProfile: true,
			adminProfile: true,
		},
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const displayName =
		user.developerProfile?.name ||
		user.recruiterProfile?.name ||
		user.adminProfile?.name ||
		(data as any).name ||
		"User";

	const jwtPayload = {
		userId: user.id,
		name: displayName,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

// 5. Google OAuth Callback
const googleCallback = async (user: {
	id: string;
	name: string;
	email: string;
	role: Role;
}) => {
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

// 6. Forgot Password
const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
		include: {
			developerProfile: true,
			recruiterProfile: true,
			adminProfile: true,
		},
	});
	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist!");
	}
	if (isUserExists.status === UserStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is suspended");
	}
	if (isUserExists.isDeleted) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is deleted");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "User email is not verified");
	}

	if (
		isUserExists.googleId &&
		!isUserExists.password &&
		isUserExists.authProvider === AuthProvider.GOOGLE
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account was created with Google. Please sign in with Google.",
		);
	}

	const otp = crypto.randomInt(100000, 1000000).toString();
	const key = `forgot-password-otp:${isUserExists.email}`;
	const expirationSecound = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSecound,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password.ejs",
	);

	const displayName =
		isUserExists.developerProfile?.name ||
		isUserExists.recruiterProfile?.name ||
		isUserExists.adminProfile?.name ||
		"User";

	const templateData = {
		name: displayName,
		otp,
		expireMinites: expirationSecound / 60,
	};

	try {
		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: isUserExists.email,
			subject: "Forgot Password - Developer Assessment Platform",
			html,
		});
	} catch (mailError) {
		console.error("Error sending forgot password email:", mailError);
	}
};

// 7. Reset Password
const resetPassword = async (payload: any) => {
	const { email, otp, newPassword } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
		include: {
			developerProfile: true,
			recruiterProfile: true,
			adminProfile: true,
		},
	});
	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist!");
	}
	if (isUserExists.status === UserStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is suspended");
	}
	if (isUserExists.isDeleted) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is deleted");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "User email is not verified");
	}

	if (
		isUserExists.googleId &&
		!isUserExists.password &&
		isUserExists.authProvider === AuthProvider.GOOGLE
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account was created with Google. Please sign in with Google.",
		);
	}

	const key = `forgot-password-otp:${isUserExists.email}`;
	const redisOTP = await redisClient.get(key);

	if (!redisOTP) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
	}
	if (redisOTP !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: { email: isUserExists.email },
		data: { password: hashedNewPassword },
	});

	await redisClient.del([key]);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);

	const displayName =
		isUserExists.developerProfile?.name ||
		isUserExists.recruiterProfile?.name ||
		isUserExists.adminProfile?.name ||
		"User";

	try {
		const templateData = {
			name: displayName,
		};

		const html = await ejs.renderFile(templatePath, templateData);

		await transporter.sendMail({
			from: config.email_sender,
			to: isUserExists.email,
			subject: "Password Changed - Developer Assessment Platform",
			html,
		});
	} catch (mailError) {
		console.error("Error sending reset password success email:", mailError);
	}
};

// 7.1. Change Password (For Logged In User)
const changePassword = async (
	userId: string,
	payload: IChangePasswordPayload,
) => {
	const { oldPassword, newPassword } = payload;

	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been suspended");
	}

	// If user already has a password, verify old password
	if (user.password) {
		if (!oldPassword) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Current password is required to change your password",
			);
		}

		const isPasswordMatched = await bcrypt.compare(oldPassword, user.password);
		if (!isPasswordMatched) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Current/old password does not match",
			);
		}

		if (oldPassword === newPassword) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"New password cannot be the same as your old password",
			);
		}
	}

	const hashedPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: { id: userId },
		data: {
			password: hashedPassword,
		},
	});

	return {
		message: user.password
			? "Password changed successfully"
			: "Password set successfully. You can now log in with either Google or email and password.",
	};
};

// 8. Get Me (Current Authenticated User)
const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			developerProfile: true,
			recruiterProfile: true,
			adminProfile: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been suspended");
	}

	if (user.isDeleted) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted");
	}

	const profile =
		user.developerProfile || user.recruiterProfile || user.adminProfile || null;

	return {
		user: {
			id: user.id,
			email: user.email,
			role: user.role,
			status: user.status,
			authProvider: user.authProvider,
			hasPassword: Boolean(user.password),
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
		profile,
	};
};

// 9. Update Developer Profile
const updateDeveloperProfile = async (
	userId: string,
	payload: IUpdateDeveloperProfilePayload,
	file?: Express.Multer.File,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { developerProfile: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role !== Role.DEVELOPER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only developers can update this profile",
		);
	}

	let cloudinaryResult: UploadApiResponse | null = null;
	const fileBuffer = file?.buffer || payload.buffer;

	if (fileBuffer) {
		cloudinaryResult = await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				cloudinary.uploader
					.upload_stream(
						{ resource_type: "auto", folder: "profiles" },
						(error, result) => {
							if (error) return reject(error);
							if (!result) return reject(new Error("Cloudinary error"));
							resolve(result);
						},
					)
					.end(fileBuffer);
			},
		);
	}

	const currentProfile = user.developerProfile;

	const name =
		payload.name && payload.name.trim() !== ""
			? payload.name.trim()
			: currentProfile?.name || "";

	const phone =
		payload.phone !== undefined ? payload.phone : currentProfile?.phone || null;

	const avatarUrl = cloudinaryResult
		? cloudinaryResult.secure_url
		: payload.avatarUrl !== undefined
			? payload.avatarUrl
			: currentProfile?.avatarUrl || null;

	const skills =
		payload.skills !== undefined
			? Array.isArray(payload.skills)
				? payload.skills
				: typeof payload.skills === "string"
					? (payload.skills as string).split(",").map((s) => s.trim())
					: currentProfile?.skills || []
			: currentProfile?.skills || [];

	const experienceYears =
		payload.experienceYears !== undefined
			? Number(payload.experienceYears)
			: (currentProfile?.experienceYears ?? 0);

	const githubUrl =
		payload.githubUrl !== undefined
			? payload.githubUrl
			: currentProfile?.githubUrl || null;

	const portfolioUrl =
		payload.portfolioUrl !== undefined
			? payload.portfolioUrl
			: currentProfile?.portfolioUrl || null;

	const resumeUrl =
		payload.resumeUrl !== undefined
			? payload.resumeUrl
			: currentProfile?.resumeUrl || null;

	const updatedProfile = await prisma.developer.upsert({
		where: { userId },
		create: {
			userId,
			name,
			phone,
			avatarUrl,
			skills,
			experienceYears,
			githubUrl,
			portfolioUrl,
			resumeUrl,
		},
		update: {
			name,
			phone,
			avatarUrl,
			skills,
			experienceYears,
			githubUrl,
			portfolioUrl,
			resumeUrl,
		},
	});

	return updatedProfile;
};

export const AuthService = {
	registerDeveloper,
	verifyDeveloperEmail,
	registerRecruiter,
	verifyRecruiterEmail,
	loginUser,
	refreshToken,
	googleCallback,
	forgotPassword,
	resetPassword,
	changePassword,
	getMe,
	updateDeveloperProfile,
};
