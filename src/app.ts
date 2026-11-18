import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import passport from "passport";

import "./app/config/passport";
import config from "./app/config";
import { getBkashIdToken } from "./app/lib/bkash";

import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";

import { AuthRoutes } from "./app/module/auth/auth.route";
import { AssessmentRoutes } from "./app/module/assessment/assessment.route";
import { GlobalQuestionRoutes } from "./app/module/globalQuestion/globalQuestion.route";
// import { UserRouters } from "./app/module/user/user.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cookieParser());

app.use(passport.initialize());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/assessments", AssessmentRoutes);
app.use("/api/v1/global-questions", GlobalQuestionRoutes);

// app.use("/api/v1/user", UserRouters);

app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const grantIdTokenResult = await getBkashIdToken();

		console.log(grantIdTokenResult);

		res.status(httpStatus.OK).json({
			success: true,
			message: "bKash Connection Successful",
			data: grantIdTokenResult,
		});
	} catch (error) {
		console.log(error);
		next(error);
	}
});

app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Developer Assessment Platform Backend",
	});
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;
