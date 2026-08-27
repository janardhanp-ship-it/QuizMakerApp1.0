"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/auth/redirect";
import { validatePassword } from "@/lib/auth/validation";

type FieldErrors = Record<string, string>;

export function LoginForm({ nextPath }: { nextPath?: string }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		const form = new FormData(event.currentTarget);
		const errors: FieldErrors = {};
		const identifier = String(form.get("identifier") ?? "").trim();
		if (!identifier) errors.identifier = "This field is required";
		validatePassword(form.get("password"), errors, true);
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			return;
		}
		setFieldErrors({});
		setPending(true);
		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					identifier,
					password: String(form.get("password") ?? ""),
				}),
			});
			const data = (await response.json()) as { error?: string; fields?: FieldErrors };
			if (!response.ok) {
				setFieldErrors(data.fields ?? {});
				setFormError(data.error ?? "Could not log in");
				return;
			}
			router.push(safeNextPath(nextPath));
			router.refresh();
		} catch {
			setFormError("Could not log in");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Log in</CardTitle>
				<CardDescription>Use your username or email and password.</CardDescription>
			</CardHeader>
			<form onSubmit={onSubmit}>
				<CardContent>
					<FieldGroup>
						<Field data-invalid={!!fieldErrors.identifier || undefined}>
							<FieldLabel htmlFor="identifier">Username or email</FieldLabel>
							<Input id="identifier" name="identifier" autoComplete="username" required />
							<FieldError errors={[{ message: fieldErrors.identifier }]} />
						</Field>
						<Field data-invalid={!!fieldErrors.password || undefined}>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								minLength={8}
							/>
							<FieldError errors={[{ message: fieldErrors.password }]} />
						</Field>
						{formError ? <FieldError>{formError}</FieldError> : null}
					</FieldGroup>
				</CardContent>
				<CardFooter className="flex flex-col items-stretch gap-3">
					<Button type="submit" disabled={pending}>
						{pending ? "Logging in…" : "Log in"}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						Need an account?{" "}
						<Link href="/register" className="text-primary underline-offset-4 hover:underline">
							Register
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
