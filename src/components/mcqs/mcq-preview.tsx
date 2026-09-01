"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PreviewMcq } from "@/lib/mcqs/types";

export function McqPreview({ mcq }: { mcq: PreviewMcq }) {
	const router = useRouter();
	const [choiceId, setChoiceId] = useState<string>("");
	const [result, setResult] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		const response = await fetch(`/api/mcqs/${mcq.id}/attempts`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ choiceId }),
		});
		setSubmitting(false);
		if (!response.ok) {
			setError("Could not record this attempt.");
			return;
		}
		const payload = (await response.json()) as { attempt: { isCorrect: boolean } };
		setResult(payload.attempt.isCorrect);
	}

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<h1 className="font-heading text-2xl font-medium">{mcq.name}</h1>
			<p className="text-muted-foreground">{mcq.question}</p>
			<fieldset className="space-y-3">
				<legend className="font-medium">Choices</legend>
				{mcq.choices.map((choice, index) => (
					<label key={choice.id} className="flex items-center gap-2 text-sm" htmlFor={`preview-${choice.id}`}>
						<input
							id={`preview-${choice.id}`}
							type="radio"
							name="previewChoice"
							value={choice.id}
							checked={choiceId === choice.id}
							onChange={() => setChoiceId(choice.id)}
							required
						/>
						Choice {index + 1}: {choice.body}
					</label>
				))}
			</fieldset>
			{result === null ? null : (
				<p className="text-sm font-medium">{result ? "Correct" : "Incorrect"}</p>
			)}
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<div className="flex gap-2">
				<Button type="submit" disabled={submitting || !choiceId}>
					Submit
				</Button>
				<Button type="button" variant="outline" onClick={() => router.push("/quizzes")}>
					Back
				</Button>
			</div>
		</form>
	);
}
