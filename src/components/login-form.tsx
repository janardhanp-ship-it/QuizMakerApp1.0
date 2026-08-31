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
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/auth/redirect";
import { validatePassword } from "@/lib/auth/validation";

type FieldErrors = Record<string, string>;

export function LoginForm({
	className,
	nextPath,
	...props
}: ComponentProps<"div"> & { nextPath?: string }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>Enter your email below to login to your account</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit}>
						<FieldGroup>
							<Field data-invalid={fieldErrors.identifier ? "true" : undefined}>
								<FieldLabel htmlFor="email">Email</FieldLabel>
								<Input
									id="email"
									name="identifier"
									type="text"
									placeholder="m@example.com"
									autoComplete="username"
									required
								/>
								<FieldDescription>Username or email.</FieldDescription>
								<FieldError errors={[{ message: fieldErrors.identifier }]} />
							</Field>
							<Field data-invalid={fieldErrors.password ? "true" : undefined}>
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
							<Field>
								<Button type="submit" className="w-full" disabled={pending}>
									{pending ? "Logging in…" : "Login"}
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account?{" "}
									<Link href="/register" className="underline-offset-4 hover:underline">
										Sign up
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
