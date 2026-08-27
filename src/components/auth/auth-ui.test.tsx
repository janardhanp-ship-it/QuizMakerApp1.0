import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
	default: ({ children, href }: { children: React.ReactNode; href: string }) => (
		<a href={href}>{children}</a>
	),
}));

import { LoginForm } from "@/components/auth/login-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { RegisterForm } from "@/components/auth/register-form";

describe("Phase 4: auth UI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("blocks register with an invalid username before calling the API", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);
		await user.type(screen.getByLabelText("First name"), "Ada");
		await user.type(screen.getByLabelText("Last name"), "Lovelace");
		await user.type(screen.getByLabelText("Username"), "ab");
		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
		await user.click(screen.getByRole("button", { name: "Register" }));
		expect(await screen.findByText(/3–32 characters/i)).toBeTruthy();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("registers and navigates to the MCQ stub after a successful response", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ user: { id: "1", username: "ada" } }), { status: 201 }),
		);
		render(<RegisterForm />);
		await user.type(screen.getByLabelText("First name"), "Ada");
		await user.type(screen.getByLabelText("Last name"), "Lovelace");
		await user.type(screen.getByLabelText("Username"), "ada");
		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
		await user.click(screen.getByRole("button", { name: "Register" }));
		expect(fetch).toHaveBeenCalledWith(
			"/api/auth/register",
			expect.objectContaining({ method: "POST", credentials: "include" }),
		);
		await vi.waitFor(() => {
			expect(push).toHaveBeenCalledWith("/quizzes");
		});
	});

	it("shows a generic login error and does not claim the email is missing", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid username/email or password" }), {
				status: 401,
			}),
		);
		render(<LoginForm />);
		await user.type(screen.getByLabelText("Username or email"), "ada");
		await user.type(screen.getByLabelText("Password"), "wrong-password");
		await user.click(screen.getByRole("button", { name: /^log in$/i }));
		expect(await screen.findByText("Invalid username/email or password")).toBeTruthy();
		expect(screen.queryByText(/email not found/i)).toBeNull();
		expect(push).not.toHaveBeenCalled();
	});

	it("logs out and sends the user to login", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		render(<LogoutButton />);
		await user.click(screen.getByRole("button", { name: /log out/i }));
		expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
			method: "POST",
			credentials: "include",
		});
		await vi.waitFor(() => {
			expect(push).toHaveBeenCalledWith("/login");
		});
	});
});
