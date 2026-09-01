"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChoiceInput, McqWithChoices } from "@/lib/mcqs/types";

function emptyChoices(): ChoiceInput[] {
	return [
		{ body: "", isCorrect: true },
		{ body: "", isCorrect: false },
	];
}

export function McqForm({
	mode,
	mcq,
}: {
	mode: "create" | "edit";
	mcq?: McqWithChoices;
}) {
	const router = useRouter();
	const [name, setName] = useState(mcq?.name ?? "");
	const [question, setQuestion] = useState(mcq?.question ?? "");
	const [choices, setChoices] = useState<ChoiceInput[]>(
		mcq?.choices.map((choice) => ({ body: choice.body, isCorrect: choice.isCorrect })) ?? emptyChoices(),
	);
	const [fields, setFields] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [choicesLocked, setChoicesLocked] = useState(false);
	const [saving, setSaving] = useState(false);

	function setCorrect(index: number) {
		setChoices((current) => current.map((choice, i) => ({ ...choice, isCorrect: i === index })));
	}

	function updateBody(index: number, body: string) {
		setChoices((current) => current.map((choice, i) => (i === index ? { ...choice, body } : choice)));
	}

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}
		setChoices((current) => [...current, { body: "", isCorrect: false }]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}
		setChoices((current) => {
			const next = current.filter((_, i) => i !== index);
			if (!next.some((choice) => choice.isCorrect) && next[0]) {
				next[0] = { ...next[0], isCorrect: true };
			}
			return next;
		});
	}

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setSaving(true);
		setFields({});
		setFormError(null);
		const url = mode === "create" ? "/api/mcqs" : `/api/mcqs/${mcq?.id}`;
		const payload = { name, question, ...(choicesLocked ? {} : { choices }) };
		const response = await fetch(url, {
			method: mode === "create" ? "POST" : "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		setSaving(false);
		if (response.ok) {
			router.push("/quizzes");
			return;
		}
		if (response.status === 409 && mode === "edit" && !choicesLocked) {
			setChoicesLocked(true);
			setFormError("Choices cannot be changed after someone has practiced this question. Save again to update the name and question only.");
			return;
		}
		const errorPayload = (await response.json().catch(() => ({}))) as {
			error?: string;
			fields?: Record<string, string>;
		};
		if (errorPayload.fields) {
			setFields(errorPayload.fields);
		}
		setFormError(errorPayload.error ?? "Could not save this question.");
	}

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<h1 className="font-heading text-2xl font-medium">
				{mode === "create" ? "Create question" : "Edit question"}
			</h1>
			{formError ? <p className="text-sm text-destructive">{formError}</p> : null}
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
					<Input id="mcq-name" value={name} onChange={(event) => setName(event.target.value)} required />
					<FieldError errors={fields.name ? [{ message: fields.name }] : []} />
				</Field>
				<Field>
					<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
					<Textarea
						id="mcq-question"
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
						required
					/>
					<FieldError errors={fields.question ? [{ message: fields.question }] : []} />
				</Field>
			</FieldGroup>

			<fieldset className="space-y-4" disabled={choicesLocked}>
				<legend className="font-medium">Choices</legend>
				<p className="text-sm text-muted-foreground">
					{choicesLocked
						? "Choices are locked because this question already has attempts."
						: "Add 2 to 6 choices and mark exactly one as correct."}
				</p>
				{choices.map((choice, index) => (
					<div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
						<Field className="flex-1">
							<FieldLabel htmlFor={`choice-${index}`}>Choice {index + 1}</FieldLabel>
							<Input
								id={`choice-${index}`}
								value={choice.body}
								onChange={(event) => updateBody(index, event.target.value)}
								required
							/>
						</Field>
						<div className="flex items-center gap-3 pb-1">
							<label className="flex items-center gap-2 text-sm" htmlFor={`correct-${index}`}>
								<input
									id={`correct-${index}`}
									type="radio"
									name="correctChoice"
									checked={choice.isCorrect}
									onChange={() => setCorrect(index)}
								/>
								Mark choice {index + 1} as correct
							</label>
							{choices.length > 2 ? (
								<Button type="button" variant="ghost" onClick={() => removeChoice(index)}>
									Remove
								</Button>
							) : null}
						</div>
					</div>
				))}
				<Button type="button" variant="outline" onClick={addChoice} disabled={choicesLocked || choices.length >= 6}>
					Add choice
				</Button>
			</fieldset>

			<div className="flex gap-2">
				<Button type="submit" disabled={saving}>
					Save
				</Button>
				<Button type="button" variant="outline" onClick={() => router.push("/quizzes")}>
					Cancel
				</Button>
			</div>
		</form>
	);
}
