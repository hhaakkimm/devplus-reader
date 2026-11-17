// Pure quiz logic with no node imports, so the client component can share it with the loader.

export const LEVELS = ["junior", "mid", "senior", "staff"] as const;
export type Level = (typeof LEVELS)[number];

type Common = { level: Level; question: string; explanation: string };
export type Question = Common &
  (
    | { type: "true_false"; answer: boolean }
    | { type: "choice"; options: string[]; answer: number }
    // answer: item indexes from top to bottom
    | { type: "ranking"; items: string[]; answer: number[] }
    // answer[i]: index in `right` that matches left[i]
    | { type: "matching"; left: string[]; right: string[]; answer: number[] }
  );

export type Quiz = {
  slug: string; // "module/quiz"
  moduleSlug: string;
  quizSlug: string;
  title: string;
  source?: string;
  questions: Question[];
};

// null: nothing chosen yet. ranking: item indexes in the current order.
// matching: chosen `right` index per left row, -1 while unset.
export type Answer = boolean | number | number[] | null;

export function initialAnswer(q: Question): Answer {
  if (q.type === "matching") return q.left.map(() => -1);
  if (q.type === "ranking") {
    const order = q.items.map((_, i) => i);
    // Never start solved: swap the first two items when the natural order is already the answer.
    if (order.every((v, i) => v === q.answer[i])) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  }
  return null;
}

export function canCheck(q: Question, a: Answer): boolean {
  if (q.type === "matching") return Array.isArray(a) && a.every((v) => v >= 0);
  return a !== null;
}

export function isCorrect(q: Question, a: Answer): boolean {
  if (q.type === "ranking" || q.type === "matching") {
    return (
      Array.isArray(a) &&
      a.length === q.answer.length &&
      a.every((v, i) => v === q.answer[i])
    );
  }
  return a === q.answer;
}
