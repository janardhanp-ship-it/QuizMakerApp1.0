import type { AttemptRow, ChoiceRow, McqRow } from "@/lib/mcqs/types";
import type { UserRow } from "@/lib/users/types";

type SessionRow = {
	id: string;
	user_id: string;
	token_hash: string;
	expires_at: string;
	created_at: string;
};

function normalizeSql(sql: string): string {
	return sql.replace(/\s+/g, " ").trim();
}

export function createFakeD1() {
	const users: UserRow[] = [];
	const sessions: SessionRow[] = [];
	const mcqs: McqRow[] = [];
	const choices: ChoiceRow[] = [];
	const attempts: AttemptRow[] = [];

	return {
		users,
		sessions,
		mcqs,
		choices,
		attempts,
		prepare(sql: string) {
			const normalized = normalizeSql(sql);
			const bound = (...params: unknown[]) => {
				return {
					async all<T>() {
							if (normalized.includes("FROM users WHERE id =")) {
								const row = users.find((user) => user.id === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM users WHERE username =")) {
								const row = users.find((user) => user.username === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM users WHERE email =")) {
								const row = users.find((user) => user.email === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM sessions") && normalized.includes("token_hash")) {
								const now = String(params[1] ?? "");
								const row = sessions.find(
									(session) => session.token_hash === params[0] && session.expires_at > now,
								);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM mcqs WHERE created_by =")) {
								const rows = mcqs
									.filter((row) => row.created_by === params[0])
									.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
								return { results: rows as T[] };
							}
							if (normalized.includes("FROM mcqs WHERE id =") && normalized.includes("AND created_by =")) {
								const row = mcqs.find((item) => item.id === params[0] && item.created_by === params[1]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM mcqs WHERE id =")) {
								const row = mcqs.find((item) => item.id === params[0]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM mcqs ORDER BY")) {
								const rows = [...mcqs].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
								return { results: rows as T[] };
							}
							if (normalized.includes("FROM choices WHERE id =") && normalized.includes("AND mcq_id =")) {
								const row = choices.find((item) => item.id === params[0] && item.mcq_id === params[1]);
								return { results: row ? [row as T] : [] };
							}
							if (normalized.includes("FROM choices WHERE mcq_id =")) {
								const rows = choices
									.filter((item) => item.mcq_id === params[0])
									.sort((a, b) => a.position - b.position);
								return { results: rows as T[] };
							}
							if (normalized.includes("FROM attempts WHERE mcq_id =")) {
								const rows = attempts
									.filter((item) => item.mcq_id === params[0])
									.sort((a, b) => b.created_at.localeCompare(a.created_at));
								return { results: rows as T[] };
							}
							return { results: [] as T[] };
						},
						async run() {
							if (normalized.startsWith("INSERT INTO users")) {
								const username = String(params[3]);
								const email = String(params[4]);
								if (users.some((user) => user.username === username)) {
									throw new Error("UNIQUE constraint failed: users.username");
								}
								if (users.some((user) => user.email === email)) {
									throw new Error("UNIQUE constraint failed: users.email");
								}
								users.push({
									id: String(params[0]),
									first_name: String(params[1]),
									last_name: String(params[2]),
									username,
									email,
									password_hash: String(params[5]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("UPDATE users")) {
								const id = String(params[6]);
								const username = String(params[2]);
								const email = String(params[3]);
								const index = users.findIndex((user) => user.id === id);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								if (users.some((user) => user.username === username && user.id !== id)) {
									throw new Error("UNIQUE constraint failed: users.username");
								}
								if (users.some((user) => user.email === email && user.id !== id)) {
									throw new Error("UNIQUE constraint failed: users.email");
								}
								users[index] = {
									id,
									first_name: String(params[0]),
									last_name: String(params[1]),
									username,
									email,
									password_hash: String(params[4]),
								};
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("INSERT INTO sessions")) {
								sessions.push({
									id: String(params[0]),
									user_id: String(params[1]),
									token_hash: String(params[2]),
									expires_at: String(params[3]),
									created_at: String(params[4]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("DELETE FROM sessions WHERE user_id")) {
								const before = sessions.length;
								const remaining = sessions.filter((session) => session.user_id !== params[0]);
								sessions.splice(0, sessions.length, ...remaining);
								return { meta: { changes: before - sessions.length } };
							}
							if (normalized.startsWith("DELETE FROM sessions WHERE token_hash")) {
								const before = sessions.length;
								const remaining = sessions.filter((session) => session.token_hash !== params[0]);
								sessions.splice(0, sessions.length, ...remaining);
								return { meta: { changes: before - sessions.length } };
							}
							if (normalized.startsWith("DELETE FROM users")) {
								const index = users.findIndex((user) => user.id === params[0]);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								users.splice(index, 1);
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("INSERT INTO mcqs")) {
								mcqs.push({
									id: String(params[0]),
									created_by: String(params[1]),
									name: String(params[2]),
									question: String(params[3]),
									created_at: String(params[4]),
									updated_at: String(params[5]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("UPDATE mcqs SET")) {
								const index = mcqs.findIndex(
									(row) => row.id === String(params[3]) && row.created_by === String(params[4]),
								);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								mcqs[index] = {
									...mcqs[index],
									name: String(params[0]),
									question: String(params[1]),
									updated_at: String(params[2]),
								};
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("DELETE FROM mcqs")) {
								const index = mcqs.findIndex(
									(row) => row.id === String(params[0]) && row.created_by === String(params[1]),
								);
								if (index < 0) {
									return { meta: { changes: 0 } };
								}
								const mcqId = mcqs[index].id;
								mcqs.splice(index, 1);
								const remainingChoices = choices.filter((row) => row.mcq_id !== mcqId);
								choices.splice(0, choices.length, ...remainingChoices);
								const remainingAttempts = attempts.filter((row) => row.mcq_id !== mcqId);
								attempts.splice(0, attempts.length, ...remainingAttempts);
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("INSERT INTO choices")) {
								choices.push({
									id: String(params[0]),
									mcq_id: String(params[1]),
									body: String(params[2]),
									is_correct: Number(params[3]),
									position: Number(params[4]),
									created_at: String(params[5]),
									updated_at: String(params[6]),
								});
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith("DELETE FROM choices WHERE mcq_id")) {
								const remaining = choices.filter((row) => row.mcq_id !== params[0]);
								const removed = choices.length - remaining.length;
								choices.splice(0, choices.length, ...remaining);
								return { meta: { changes: removed } };
							}
							if (normalized.startsWith("INSERT INTO attempts")) {
								attempts.push({
									id: String(params[0]),
									user_id: String(params[1]),
									mcq_id: String(params[2]),
									choice_id: String(params[3]),
									is_correct: Number(params[4]),
									created_at: String(params[5]),
								});
								return { meta: { changes: 1 } };
							}
							return { meta: { changes: 0 } };
						},
					};
				};
				return {
					bind: bound,
					all: <T>() => bound().all<T>(),
					run: () => bound().run(),
				};
			},
		async batch(statements: { run: () => Promise<unknown> }[]) {
			const results = [];
			for (const statement of statements) {
				results.push(await statement.run());
			}
			return results;
		},
	};
}
