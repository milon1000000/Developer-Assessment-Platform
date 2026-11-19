import crypto from "crypto";

/**
 * Generates an auto-generated secure password satisfying:
 * - Minimum 8 characters long (default: 12)
 * - At least 1 lowercase letter (/[a-z]/)
 * - At least 1 uppercase letter (/[A-Z]/)
 * - At least 1 number (/[0-9]/)
 * - At least 1 special character (/[^A-Za-z0-9]/)
 */
export const generateStrongPassword = (length = 12): string => {
	const lower = "abcdefghijklmnopqrstuvwxyz";
	const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const digits = "0123456789";
	const special = "!@#$%^&*()_+~`|}{[]:;?><,.-=";

	const getRandomChar = (charset: string) =>
		charset[crypto.randomInt(0, charset.length)];

	// Guarantee at least 1 char from each mandatory set
	const passwordChars = [
		getRandomChar(lower),
		getRandomChar(upper),
		getRandomChar(digits),
		getRandomChar(special),
	];

	const allChars = lower + upper + digits + special;
	const remainingLength = Math.max(length, 8) - passwordChars.length;

	for (let i = 0; i < remainingLength; i++) {
		passwordChars.push(getRandomChar(allChars));
	}

	// Fisher-Yates shuffle
	for (let i = passwordChars.length - 1; i > 0; i--) {
		const j = crypto.randomInt(0, i + 1);
		[passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
	}

	return passwordChars.join("");
};
