import { describe, expect, it } from "vitest";

import { uniqueFieldFromD1Error } from "@/lib/users/errors";

describe("Phase 2: unique constraint mapping", () => {
	it("maps D1 unique failures to username or email", () => {
		expect(uniqueFieldFromD1Error(new Error("UNIQUE constraint failed: users.username"))).toBe(
			"username",
		);
		expect(uniqueFieldFromD1Error(new Error("UNIQUE constraint failed: idx_users_email"))).toBe(
			"email",
		);
		expect(uniqueFieldFromD1Error(new Error("disk I/O error"))).toBe("unknown");
	});
});
