"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentProps, type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { validateEmail, validatePassword, validateUsername } from "@/lib/auth/validation";

type FieldErrors = Record<string, string>;

export function SignupForm({ ...props }: ComponentProps<typeof Card>) {
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
		const password = String(form.get("password") ?? "");
		const confirmPassword = String(form.get("confirmPassword") ?? "");
		if (confirmPassword !== password) {
			errors.confirmPassword = "Passwords do not match";
		}
		return errors;
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>Enter your information below to create your account</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<Field data-invalid={fieldErrors.firstName ? "true" : undefined}>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input
								id="firstName"
								name="firstName"
								type="text"
								placeholder="Ada"
								autoComplete="given-name"
								required
							/>
							<FieldError errors={[{ message: fieldErrors.firstName }]} />
						</Field>
						<Field data-invalid={fieldErrors.lastName ? "true" : undefined}>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input
								id="lastName"
								name="lastName"
								type="text"
								placeholder="Lovelace"
								autoComplete="family-name"
								required
							/>
							<FieldError errors={[{ message: fieldErrors.lastName }]} />
						</Field>
						<Field data-invalid={fieldErrors.username ? "true" : undefined}>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input
								id="username"
								name="username"
								type="text"
								placeholder="ada"
								autoComplete="username"
								required
							/>
							<FieldDescription>3–32 characters: lowercase letters, numbers, and underscores.</FieldDescription>
							<FieldError errors={[{ message: fieldErrors.username }]} />
						</Field>
						<Field data-invalid={fieldErrors.email ? "true" : undefined}>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="m@example.com"
								autoComplete="email"
								required
							/>
							<FieldDescription>
								We&apos;ll use this to contact you. We will not share your email with anyone else.
							</FieldDescription>
							<FieldError errors={[{ message: fieldErrors.email }]} />
						</Field>
						<Field data-invalid={fieldErrors.password ? "true" : undefined}>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
							/>
							<FieldDescription>Must be at least 8 characters long.</FieldDescription>
							<FieldError errors={[{ message: fieldErrors.password }]} />
						</Field>
						<Field data-invalid={fieldErrors.confirmPassword ? "true" : undefined}>
							<FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
							<Input
								id="confirm-password"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
							<FieldError errors={[{ message: fieldErrors.confirmPassword }]} />
						</Field>
						{formError ? <FieldError>{formError}</FieldError> : null}
						<FieldGroup>
							<Field>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Creating account…" : "Create Account"}
								</Button>
								<FieldDescription className="px-6 text-center">
									Already have an account?{" "}
									<Link href="/login" className="underline-offset-4 hover:underline">
										Sign in
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
