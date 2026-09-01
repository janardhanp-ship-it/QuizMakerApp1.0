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

import { McqForm } from "@/components/mcqs/mcq-form";
import { McqList } from "@/components/mcqs/mcq-list";

const sample = {
	id: "mcq-1",
	name: "Photosynthesis",
	question: "Which gas do plants absorb?",
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
	isOwner: true,
};

describe("Phase 5: MCQ UI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("shows name, question, and actions columns and a create button", () => {
		render(<McqList items={[sample]} />);
		expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: "Question" })).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();
		expect(screen.getByText("Photosynthesis")).toBeTruthy();
		expect(screen.getByText("Which gas do plants absorb?")).toBeTruthy();
		expect(screen.getByRole("link", { name: /create/i }).getAttribute("href")).toBe("/quizzes/new");
	});

	it("shows an empty state when there are no questions", () => {
		render(<McqList items={[]} />);
		expect(screen.getByText(/no multiple choice questions yet/i)).toBeTruthy();
		expect(screen.getByRole("link", { name: /create/i })).toBeTruthy();
	});

	it("opens row actions with edit, preview, and delete", async () => {
		const user = userEvent.setup();
		render(<McqList items={[sample]} />);
		await user.click(screen.getByRole("button", { name: /actions for photosynthesis/i }));
		expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeTruthy();
	});

	it("confirms delete then calls the API and refreshes", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		render(<McqList items={[sample]} />);
		await user.click(screen.getByRole("button", { name: /actions for photosynthesis/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
		expect(await screen.findByText(/delete this question/i)).toBeTruthy();
		await user.click(screen.getByRole("button", { name: /^delete$/i }));
		expect(fetch).toHaveBeenCalledWith(
			"/api/mcqs/mcq-1",
			expect.objectContaining({ method: "DELETE", credentials: "include" }),
		);
		await vi.waitFor(() => {
			expect(refresh).toHaveBeenCalled();
		});
	});

	it("starts the create form with two choices and blocks a seventh", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);
		expect(screen.getByLabelText("Choice 1")).toBeTruthy();
		expect(screen.getByLabelText("Choice 2")).toBeTruthy();
		expect(screen.queryByLabelText("Choice 3")).toBeNull();
		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /add choice/i }));
		expect(screen.getByLabelText("Choice 6")).toBeTruthy();
		expect((screen.getByRole("button", { name: /add choice/i }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("saves a new question and returns to the list", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcq: { id: "mcq-1" } }), { status: 201 }),
		);
		render(<McqForm mode="create" />);
		await user.type(screen.getByLabelText("Name"), "Photosynthesis");
		await user.type(screen.getByLabelText("Question"), "Which gas do plants absorb?");
		await user.type(screen.getByLabelText("Choice 1"), "Oxygen");
		await user.type(screen.getByLabelText("Choice 2"), "Carbon dioxide");
		await user.click(screen.getByLabelText("Mark choice 2 as correct"));
		await user.click(screen.getByRole("button", { name: /^save$/i }));
		expect(fetch).toHaveBeenCalledWith(
			"/api/mcqs",
			expect.objectContaining({ method: "POST", credentials: "include" }),
		);
		const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
		expect(body.choices).toHaveLength(2);
		expect(body.choices[1].isCorrect).toBe(true);
		await vi.waitFor(() => {
			expect(push).toHaveBeenCalledWith("/quizzes");
		});
	});

	it("cancel returns to the list without calling the API", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);
		await user.click(screen.getByRole("button", { name: /^cancel$/i }));
		expect(fetch).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith("/quizzes");
	});
});
