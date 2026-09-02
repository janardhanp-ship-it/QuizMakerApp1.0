"use client";

import { EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { McqListItem } from "@/lib/mcqs/types";
import { cn } from "@/lib/utils";

export function McqList({ items }: { items: McqListItem[] }) {
	const router = useRouter();
	const [pendingDelete, setPendingDelete] = useState<McqListItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirmDelete() {
		if (!pendingDelete) {
			return;
		}
		setDeleting(true);
		setError(null);
		const response = await fetch(`/api/mcqs/${pendingDelete.id}`, {
			method: "DELETE",
			credentials: "include",
		});
		setDeleting(false);
		if (!response.ok) {
			setError("Could not delete this question.");
			return;
		}
		setPendingDelete(null);
		router.refresh();
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<h1 className="font-heading text-2xl font-medium">Multiple choice questions</h1>
				<Link href="/quizzes/new" className={cn(buttonVariants())}>
					Create
				</Link>
			</div>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			{items.length === 0 ? (
				<p className="text-muted-foreground">No multiple choice questions yet. Create one to get started.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Question</TableHead>
							<TableHead className="w-16">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => (
							<TableRow key={item.id}>
								<TableCell className="font-medium">{item.name}</TableCell>
								<TableCell className="max-w-md truncate whitespace-normal">
									<span className="line-clamp-2">{item.question}</span>
								</TableCell>
								<TableCell>
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`} />
											}
										>
											<EllipsisVertical />
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											{item.isOwner ? (
												<DropdownMenuItem onClick={() => router.push(`/quizzes/${item.id}/edit`)}>
													Edit
												</DropdownMenuItem>
											) : null}
											<DropdownMenuItem onClick={() => router.push(`/quizzes/${item.id}/preview`)}>
												Preview
											</DropdownMenuItem>
											{item.isOwner ? (
												<DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(item)}>
													Delete
												</DropdownMenuItem>
											) : null}
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this question?</DialogTitle>
						<DialogDescription>
							This cannot be undone. Choices and attempts for this question will also be removed.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPendingDelete(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
