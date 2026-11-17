"use client";

import Link from "next/link";
import { useState } from "react";
import { useProgress } from "@/components/progress-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { fill, t, type Lang } from "@/lib/i18n";
import {
  canCheck,
  initialAnswer,
  isCorrect,
  type Answer,
  type Level,
  type Question,
  type Quiz,
} from "@/lib/quiz-state";

const LEVEL_LABEL: Record<Level, string> = {
  junior: "Junior",
  mid: "Middle",
  senior: "Senior",
  staff: "Staff",
};

const OK =
  "border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100";
const BAD =
  "border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100";

// What to show as "the right answer" once a question is checked.
function rightAnswer(q: Question, lang: Lang): string[] {
  switch (q.type) {
    case "true_false":
      return [t(lang, q.answer ? "optionTrue" : "optionFalse")];
    case "choice":
      return [q.options[q.answer]];
    case "ranking":
      return q.answer.map((i, n) => `${n + 1}. ${q.items[i]}`);
    case "matching":
      return q.left.map((l, i) => `${l} → ${q.right[q.answer[i]]}`);
  }
}

function QuestionBody({
  lang,
  q,
  answer,
  setAnswer,
  checked,
}: {
  lang: Lang;
  q: Question;
  answer: Answer;
  setAnswer: (a: Answer) => void;
  checked: boolean;
}) {
  if (q.type === "true_false" || q.type === "choice") {
    const options =
      q.type === "choice"
        ? q.options.map((label, value) => ({ label, value }))
        : [
            { label: t(lang, "optionTrue"), value: true },
            { label: t(lang, "optionFalse"), value: false },
          ];
    return (
      <div
        role="group"
        aria-label={t(lang, "answerOptions")}
        className="space-y-2"
      >
        {options.map((o) => {
          const picked = answer === o.value;
          const right = checked && o.value === q.answer;
          const wrong = checked && picked && !right;
          return (
            <button
              key={o.label}
              type="button"
              disabled={checked}
              aria-pressed={picked}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                right
                  ? OK
                  : wrong
                    ? BAD
                    : checked
                      ? "opacity-60"
                      : "hover:border-foreground/40 hover:bg-muted"
              }`}
              onClick={() => setAnswer(o.value)}
            >
              <span className="flex-1">{o.label}</span>
              {right && <span aria-hidden>✓</span>}
              {wrong && <span aria-hidden>✗</span>}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === "ranking") {
    const order = answer as number[];
    const move = (from: number, to: number) => {
      const next = [...order];
      [next[from], next[to]] = [next[to], next[from]];
      setAnswer(next);
    };
    return (
      <ol className="space-y-2" aria-label={t(lang, "orderThem")}>
        {order.map((item, pos) => (
          <li
            key={item}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              checked ? (item === q.answer[pos] ? OK : BAD) : ""
            }`}
          >
            <span className="w-6 text-muted-foreground">{pos + 1}.</span>
            <span className="flex-1">{q.items[item]}</span>
            <Button
              variant="outline"
              size="sm"
              className="max-sm:size-11"
              disabled={checked || pos === 0}
              aria-label={fill(t(lang, "moveUp"), { item: q.items[item] })}
              onClick={() => move(pos, pos - 1)}
            >
              ↑
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="max-sm:size-11"
              disabled={checked || pos === order.length - 1}
              aria-label={fill(t(lang, "moveDown"), { item: q.items[item] })}
              onClick={() => move(pos, pos + 1)}
            >
              ↓
            </Button>
          </li>
        ))}
      </ol>
    );
  }
  const chosen = answer as number[];
  return (
    <ul className="space-y-3">
      {q.left.map((label, i) => (
        <li key={label} className="space-y-1">
          <label htmlFor={`match-${i}`}>{label}</label>
          <NativeSelect
            id={`match-${i}`}
            value={chosen[i]}
            disabled={checked}
            aria-invalid={checked && chosen[i] !== q.answer[i]}
            className={`w-full ${
              checked && chosen[i] === q.answer[i]
                ? "[&_select]:border-green-600 [&_select]:bg-green-50 dark:[&_select]:bg-green-950"
                : ""
            }`}
            onChange={(e) =>
              setAnswer(
                chosen.map((v, j) => (j === i ? Number(e.target.value) : v)),
              )
            }
          >
            <NativeSelectOption value={-1}>
              {t(lang, "chooseMatch")}
            </NativeSelectOption>
            {q.right.map((r, j) => (
              <NativeSelectOption key={r} value={j}>
                {r}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {/* A closed select cuts a long option off; the chosen one is repeated in full. */}
          {chosen[i] >= 0 && (
            <p className="text-sm text-muted-foreground">
              {q.right[chosen[i]]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function QuizRunner({ quiz, lang }: { quiz: Quiz; lang: Lang }) {
  const { saveQuiz } = useProgress();
  const all = quiz.questions.map((_, i) => i);
  const [queue, setQueue] = useState(all);
  const [fullPass, setFullPass] = useState(true);
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer>(() =>
    initialAnswer(quiz.questions[0]),
  );
  const [checked, setChecked] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  function begin(next: number[], full: boolean) {
    setQueue(next);
    setFullPass(full);
    setPos(0);
    setAnswer(initialAnswer(quiz.questions[next[0]]));
    setChecked(false);
    setWrong([]);
    setDone(false);
  }

  const index = queue[pos];
  const q = quiz.questions[index];
  const correct = checked && isCorrect(q, answer);

  function pick(a: Answer) {
    setAnswer(a);
    // A single tap answers true/false and choice questions at once.
    if (q.type === "true_false" || q.type === "choice") setChecked(true);
  }

  function next() {
    const nextWrong = correct ? wrong : [...wrong, index];
    setWrong(nextWrong);
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      setAnswer(initialAnswer(quiz.questions[queue[pos + 1]]));
      setChecked(false);
      return;
    }
    setDone(true);
    // Only a full pass is a result; repeating mistakes is practice and is not recorded.
    if (fullPass) {
      saveQuiz(
        quiz.moduleSlug,
        quiz.quizSlug,
        queue.length - nextWrong.length,
        queue.length,
      );
    }
  }

  if (done) {
    const score = queue.length - wrong.length;
    return (
      <Card aria-labelledby="quiz-result" role="region">
        <CardContent className="space-y-4">
          <h2 id="quiz-result" className="text-2xl font-semibold">
            {fill(t(lang, "result"), { score, total: queue.length })}
          </h2>
          <Progress value={(score / queue.length) * 100} />
          {wrong.length > 0 && (
            <div>
              <h3 className="font-semibold">{t(lang, "mistakes")}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {wrong.map((i) => (
                  <li key={i}>{quiz.questions[i].question}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {wrong.length > 0 && (
              <Button onClick={() => begin(wrong, false)}>
                {t(lang, "retryMistakes")}
              </Button>
            )}
            <Button variant="outline" onClick={() => begin(all, true)}>
              {t(lang, "retryAll")}
            </Button>
            <Link
              href={`/${lang}/quizzes/`}
              className="text-sm hover:underline"
            >
              {t(lang, "allQuizzes")}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-label={t(lang, "question")} role="region">
      <CardContent className="space-y-4">
        <Progress
          value={(pos / queue.length) * 100}
          aria-label={t(lang, "quizProgress")}
        />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {fill(t(lang, "questionOf"), { n: pos + 1, total: queue.length })}
            {!fullPass && ` · ${t(lang, "retryMode")}`}
          </span>
          <Badge variant="outline">{LEVEL_LABEL[q.level]}</Badge>
        </p>
        <h2 className="text-xl font-semibold leading-snug">{q.question}</h2>
        <div>
          <QuestionBody
            lang={lang}
            q={q}
            answer={answer}
            setAnswer={pick}
            checked={checked}
          />
        </div>
        {!checked && (q.type === "ranking" || q.type === "matching") && (
          <Button
            className="mt-4"
            disabled={!canCheck(q, answer)}
            onClick={() => setChecked(true)}
          >
            {t(lang, "check")}
          </Button>
        )}
        {checked && (
          <div role="status" className="space-y-4">
            <Alert className={correct ? OK : BAD}>
              <AlertTitle className="font-semibold">
                {t(lang, correct ? "correct" : "incorrect")}
              </AlertTitle>
              {!correct && (
                <AlertDescription className="text-current">
                  <div className="text-sm opacity-80">
                    {t(lang, "rightAnswer")}
                  </div>
                  <ul className="mt-1 list-none space-y-1 font-medium">
                    {rightAnswer(q, lang).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
            <p className="leading-relaxed text-muted-foreground">
              {q.explanation}
            </p>
            <Button onClick={next}>
              {t(lang, pos + 1 < queue.length ? "nextQuestion" : "finish")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
