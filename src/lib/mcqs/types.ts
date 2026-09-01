export type PublicChoice = {
	id: string;
	body: string;
	isCorrect: boolean;
	position: number;
};

export type PublicMcq = {
	id: string;
	name: string;
	question: string;
	createdAt: string;
	updatedAt: string;
};

export type McqListItem = PublicMcq & {
	isOwner: boolean;
};

export type PreviewChoice = {
	id: string;
	body: string;
	position: number;
};

export type PreviewMcq = PublicMcq & {
	choices: PreviewChoice[];
};

export type McqWithChoices = PublicMcq & {
	choices: PublicChoice[];
};

export type ChoiceInput = {
	body: string;
	isCorrect: boolean;
};

export type CreateMcqInput = {
	name: string;
	question: string;
	choices: ChoiceInput[];
};

export type PublicAttempt = {
	id: string;
	userId: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
};

export type McqRow = {
	id: string;
	created_by: string;
	name: string;
	question: string;
	created_at: string;
	updated_at: string;
};

export type ChoiceRow = {
	id: string;
	mcq_id: string;
	body: string;
	is_correct: number;
	position: number;
	created_at: string;
	updated_at: string;
};

export type AttemptRow = {
	id: string;
	user_id: string;
	mcq_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};
