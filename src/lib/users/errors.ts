export class UniqueConstraintError extends Error {
	readonly field: "username" | "email" | "unknown";

	constructor(field: "username" | "email" | "unknown") {
		super(
			field === "username"
				? "Username already taken"
				: field === "email"
					? "Email already taken"
					: "Account already exists",
		);
		this.name = "UniqueConstraintError";
		this.field = field;
	}
}

export class UserNotFoundError extends Error {
	constructor(message = "User not found") {
		super(message);
		this.name = "UserNotFoundError";
	}
}

export class ValidationError extends Error {
	readonly fields: Record<string, string>;

	constructor(fields: Record<string, string>, message = "Validation failed") {
		super(message);
		this.name = "ValidationError";
		this.fields = fields;
	}
}

export function uniqueFieldFromD1Error(error: unknown): "username" | "email" | "unknown" {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes("idx_users_username") || message.includes("users.username")) {
		return "username";
	}
	if (message.includes("idx_users_email") || message.includes("users.email")) {
		return "email";
	}
	return "unknown";
}
