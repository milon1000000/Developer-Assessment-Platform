import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";
import passport from "passport";
import config from "../../config";
import { AppError } from "../../utils/AppError";

const registerDeveloper = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	await AuthService.registerDeveloper(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Registration OTP has been sent to your email. Please check your inbox.",
		data: null,
	});
});

const verifyDeveloperEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.verifyDeveloperEmail(payload);

	const { accessToken, refreshToken, user, developerProfile } = result;

	const isProd = config.node_env === "production";

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24, // 24 hours
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
	});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Email verified successfully. Your developer account has been created.",
		data: {
			accessToken,
			refreshToken,
			user,
			developer: developerProfile,
		},
	});
});

const registerRecruiter = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.registerRecruiter(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: null,
	});
});

const verifyRecruiterEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.verifyRecruiterEmail(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: result,
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.loginUser(payload);
	const { accessToken, refreshToken, user, profile } = result;

	const isProd = config.node_env === "production";

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			accessToken,
			refreshToken,
			user,
			profile,
		},
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new Error("Refresh token is missing");
	}
	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

	const isProd = config.node_env === "production";

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", newRefreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: {
			accessToken,
			refreshToken: newRefreshToken,
		},
	});
});

const googleCallback = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		passport.authenticate(
			"google",
			{ session: false },
			async (err: any, user: any, info: any) => {
				try {
					if (err) {
						return res.redirect(
							`${config.frontend_url}/login?error=${encodeURIComponent(
								err?.message ||
									"Google authentication failed. Please try again.",
							)}`,
						);
					}
					if (!user) {
						return res.redirect(
							`${config.frontend_url}/login?error=${encodeURIComponent(
								info?.message || "Google authentication failed",
							)}`,
						);
					}

					const result = await AuthService.googleCallback(user);
					const { accessToken, refreshToken } = result;

					const isProd = config.node_env === "production";
					res.cookie("accessToken", accessToken, {
						httpOnly: true,
						secure: isProd,
						sameSite: isProd ? "none" : "lax",
						maxAge: 1000 * 60 * 60 * 24,
					});
					res.cookie("refreshToken", refreshToken, {
						httpOnly: true,
						secure: isProd,
						sameSite: isProd ? "none" : "lax",
						maxAge: 1000 * 60 * 60 * 24 * 7,
					});

					return res.redirect(
						`${config.frontend_url}/auth/success?accessToken=${encodeURIComponent(
							accessToken,
						)}`,
					);
				} catch (error: any) {
					return res.redirect(
						`${config.frontend_url}/login?error=${encodeURIComponent(
							error?.message ||
								"Google authentication failed. Please try again.",
						)}`,
					);
				}
			},
		)(req, res, next);
	},
);

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthService.forgotPassword(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `OTP sent to email: ${payload.email}`,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthService.resetPassword(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: null,
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	if (!userId) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
	}

	const result = await AuthService.changePassword(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	if (!userId) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
	}

	const result = await AuthService.getMe(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	if (!userId) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
	}

	const result = await AuthService.updateDeveloperProfile(
		userId,
		req.body,
		req.file,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Developer profile updated successfully",
		data: result,
	});
});

const logout = catchAsync(async (req: Request, res: Response) => {
	const isProd = config.node_env === "production";
	const cookieOptions = {
		httpOnly: true,
		secure: isProd,
		sameSite: isProd ? ("none" as const) : ("lax" as const),
	};
	res.clearCookie("accessToken", cookieOptions);
	res.clearCookie("refreshToken", cookieOptions);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged out successfully",
		data: null,
	});
});

export const AuthController = {
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
	updateProfile,
	logout,
};
