"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function logout() {
		setPending(true);
		try {
			await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
			router.push("/login");
			router.refresh();
		} finally {
			setPending(false);
		}
	}

	return (
		<Button type="button" variant="outline" onClick={logout} disabled={pending}>
			{pending ? "Logging out…" : "Log out"}
		</Button>
	);
}
