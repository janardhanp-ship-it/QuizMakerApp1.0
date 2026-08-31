import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";

describe("Phase 4: post-login redirect safety", () => {
	it("allows an in-app next path and rejects open redirects", () => {
		expect(safeNextPath("/quizzes")).toBe("/quizzes");
		expect(safeNextPath("/login")).toBe("/login");
		expect(safeNextPath("https://evil.example")).toBe("/quizzes");
		expect(safeNextPath("//evil.example")).toBe("/quizzes");
		expect(safeNextPath("\\evil")).toBe("/quizzes");
		expect(safeNextPath(undefined)).toBe("/quizzes");
	});
});
