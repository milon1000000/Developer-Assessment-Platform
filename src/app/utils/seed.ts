import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

// Create Tester Admin
export const seedTesterAdmin = async () => {
	try {
		const email = config.tester_admin_email;
		const name = config.tester_admin_name;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			console.log("Tester Admin credentials missing in environment variables.");
			return;
		}

		const isTesterAdminExist = await prisma.user.findUnique({
			where: { email },
			include: { adminProfile: true },
		});

		if (isTesterAdminExist) {
			if (
				isTesterAdminExist.adminProfile &&
				isTesterAdminExist.adminProfile.name !== name
			) {
				await prisma.admin.update({
					where: { id: isTesterAdminExist.adminProfile.id },
					data: { name },
				});
				console.log("Tester Admin Name Updated to:", name);
			} else {
				console.log("Tester Admin Already Exists!");
			}
			return;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerAdmin = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				emailVerified: true,
				adminProfile: {
					create: {
						name,
					},
				},
			},
			include: {
				adminProfile: true,
			},
		});

		console.log("Tester Admin Created : ", testerAdmin.email);
	} catch (error) {
		console.log("Error Seeding Tester Admin : ", error);
	}
};

// Create Tester Recruiter
export const seedTesterRecruiter = async () => {
	try {
		const email = config.tester_recruiter_email;
		const name = config.tester_recruiter_name;
		const password = config.tester_recruiter_password;

		if (!name || !email || !password) {
			console.log(
				"Tester Recruiter credentials missing in environment variables.",
			);
			return;
		}

		const isTesterRecruiterExist = await prisma.user.findUnique({
			where: { email },
			include: { recruiterProfile: true },
		});

		if (isTesterRecruiterExist) {
			if (
				isTesterRecruiterExist.recruiterProfile &&
				isTesterRecruiterExist.recruiterProfile.name !== name
			) {
				await prisma.recruiter.update({
					where: { id: isTesterRecruiterExist.recruiterProfile.id },
					data: { name },
				});
				console.log("Tester Recruiter Name Updated to:", name);
			} else {
				console.log("Tester Recruiter Already Exists!");
			}
			return;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerRecruiter = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: Role.RECRUITER,
				emailVerified: true,
				recruiterProfile: {
					create: {
						name,
						companyName: "TechCorp Global",
						designation: "Lead Technical Recruiter",
						isVerified: true,
					},
				},
			},
			include: {
				recruiterProfile: true,
			},
		});

		console.log("Tester Recruiter Created : ", testerRecruiter.email);
	} catch (error) {
		console.log("Error Seeding Tester Recruiter : ", error);
	}
};

// Create Tester Developer
export const seedTesterDeveloper = async () => {
	try {
		const email = config.tester_developer_email;
		const name = config.tester_developer_name;
		const password = config.tester_developer_password;

		if (!name || !email || !password) {
			return;
		}

		const isTesterDeveloperExist = await prisma.user.findUnique({
			where: { email },
			include: { developerProfile: true },
		});

		if (isTesterDeveloperExist) {
			if (
				isTesterDeveloperExist.developerProfile &&
				isTesterDeveloperExist.developerProfile.name !== name
			) {
				await prisma.developer.update({
					where: { id: isTesterDeveloperExist.developerProfile.id },
					data: { name },
				});
				console.log("Tester Developer Name Updated to:", name);
			} else {
				console.log("Tester Developer Already Exists!");
			}
			return;
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerDeveloper = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: Role.DEVELOPER,
				emailVerified: true,
				developerProfile: {
					create: {
						name,
						skills: ["TypeScript", "Node.js", "React", "PostgreSQL"],
						experienceYears: 3.5,
					},
				},
			},
			include: {
				developerProfile: true,
			},
		});

		console.log("Tester Developer Created : ", testerDeveloper.email);
	} catch (error) {
		console.log("Error Seeding Tester Developer : ", error);
	}
};
