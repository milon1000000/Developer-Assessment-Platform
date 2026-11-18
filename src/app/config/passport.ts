import passport from "passport";
import {
	Strategy as GoogleStrategy,
	type Profile,
	type VerifyCallback,
} from "passport-google-oauth20";
import { AuthProvider, Role, UserStatus } from "../../generated/prisma/enums";
import config from ".";
import { prisma } from "../lib/prisma";
import { transporter } from "../lib/nodemailer";
import path from "node:path";
import ejs from "ejs";

passport.use(
	new GoogleStrategy(
		{
			clientID: config.google_client_id,
			clientSecret: config.google_client_secret,
			callbackURL: config.google_client_callback,
			scope: ["profile", "email"],
		},
		async (
			_accessToken: string,
			_refreshToken: string,
			profile: Profile,
			done: VerifyCallback,
		) => {
			try {
				const email = profile.emails?.[0]?.value;
				const name = profile.displayName;
				const googleId = profile.id;
				const avatarUrl = profile.photos?.[0]?.value;

				if (!email) {
					return done(null, false, { message: "No email found from google" });
				}
				if (!name) {
					return done(null, false, { message: "No name found from google" });
				}

				let isNewUser = false;

				// Check if a user already exists with this email
				let user = await prisma.user.findFirst({
					where: { email },
					include: { developerProfile: true },
				});

				if (user) {
					if (user.role !== Role.DEVELOPER) {
						return done(null, false, {
							message:
								"Google sign-in is only available for Developers. Please log in with your email and password.",
						});
					}

					if (user.status === UserStatus.SUSPENDED) {
						return done(null, false, { message: "User is suspended" });
					}
					if (user.isDeleted) {
						return done(null, false, { message: "User is deleted" });
					}

					// Link Google ID if registered via credentials
					if (!user.googleId) {
						user = await prisma.user.update({
							where: { id: user.id },
							data: {
								googleId,
								authProvider: AuthProvider.GOOGLE,
								emailVerified: true,
							},
							include: { developerProfile: true },
						});
					}
				} else {
					// Brand new user -> create Developer
					user = await prisma.user.create({
						data: {
							email,
							role: Role.DEVELOPER,
							googleId,
							authProvider: AuthProvider.GOOGLE,
							emailVerified: true,
							developerProfile: {
								create: {
									name,
									avatarUrl,
								},
							},
						},
						include: { developerProfile: true },
					});
					isNewUser = true;
				}

				if (user.status === UserStatus.SUSPENDED) {
					return done(null, false, { message: "User is suspended" });
				}
				if (user.isDeleted) {
					return done(null, false, { message: "User is deleted" });
				}

				const displayName = user.developerProfile?.name || name;

				if (isNewUser) {
					const templatePath = path.join(
						process.cwd(),
						"src/app/templates/developer-google-welcome.ejs",
					);

					try {
						const templateData = {
							name: displayName,
						};

						const html = await ejs.renderFile(templatePath, templateData);

						await transporter.sendMail({
							from: config.email_sender,
							to: user.email,
							subject: "Welcome to Developer Assessment Platform",
							html,
						});
					} catch (mailError) {
						console.error("Error sending welcome email:", mailError);
					}
				}

				return done(null, {
					id: user.id,
					userId: user.id,
					name: displayName,
					email: user.email,
					role: user.role,
				} as Express.User);
			} catch (error) {
				return done(error as Error);
			}
		},
	),
);

export default passport;
