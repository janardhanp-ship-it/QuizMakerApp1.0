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
import { validateEmail, validatePassword, validateUsername } from "@/lib/auth/validation";

type FieldErrors = Record<string, string>;

export function RegisterForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	function clientValidate(form: FormData): FieldErrors {
		const errors: FieldErrors = {};
		const firstName = String(form.get("firstName") ?? "").trim();
		const lastName = String(form.get("lastName") ?? "").trim();
		if (!firstName) errors.firstName = "This field is required";
		if (!lastName) errors.lastName = "This field is required";
		validateUsername(String(form.get("username") ?? ""), errors);
		validateEmail(String(form.get("email") ?? ""), errors);
		validatePassword(form.get("password"), errors, true);
		return errors;
	}

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		const form = new FormData(event.currentTarget);
		const clientErrors = clientValidate(form);
		if (Object.keys(clientErrors).length > 0) {
			setFieldErrors(clientErrors);
			return;
		}
		setFieldErrors({});
		setPending(true);
		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: String(form.get("firstName") ?? "").trim(),
					lastName: String(form.get("lastName") ?? "").trim(),
					username: String(form.get("username") ?? "").trim(),
					email: String(form.get("email") ?? "").trim(),
					password: String(form.get("password") ?? ""),
				}),
			});
			const data = (await response.json()) as { error?: string; fields?: FieldErrors };
			if (!response.ok) {
				setFieldErrors(data.fields ?? {});
				setFormError(data.error ?? "Could not create your account");
				return;
			}
			router.push("/quizzes");
			router.refresh();
		} catch {
			setFormError("Could not create your account");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>Register to take MCQ quizzes.</CardDescription>
			</CardHeader>
			<form onSubmit={onSubmit}>
				<CardContent>
					<FieldGroup>
						<Field data-invalid={!!fieldErrors.firstName || undefined}>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input id="firstName" name="firstName" autoComplete="given-name" required />
							<FieldError errors={[{ message: fieldErrors.firstName }]} />
						</Field>
						<Field data-invalid={!!fieldErrors.lastName || undefined}>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input id="lastName" name="lastName" autoComplete="family-name" required />
							<FieldError errors={[{ message: fieldErrors.lastName }]} />
						</Field>
						<Field data-invalid={!!fieldErrors.username || undefined}>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input id="username" name="username" autoComplete="username" required />
							<FieldError errors={[{ message: fieldErrors.username }]} />
						</Field>
						<Field data-invalid={!!fieldErrors.email || undefined}>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input id="email" name="email" type="email" autoComplete="email" required />
							<FieldError errors={[{ message: fieldErrors.email }]} />
						</Field>
						<Field data-invalid={!!fieldErrors.password || undefined}>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
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
						{pending ? "Creating account…" : "Register"}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link href="/login" className="text-primary underline-offset-4 hover:underline">
							Log in
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
