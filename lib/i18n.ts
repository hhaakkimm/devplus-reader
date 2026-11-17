export type Lang = "ru" | "en";
export const LANGS = ["ru", "en"] as const;

export const isLang = (v: string): v is Lang =>
  (LANGS as readonly string[]).includes(v);

// The other language, for the toggle.
export const otherLang = (l: Lang): Lang => (l === "ru" ? "en" : "ru");

// UI texts. Module and section titles come from _module.json and stay Russian in both languages.
// `{name}` placeholders are filled by `fill`.
const ru = {
  siteName: "devplus",
  programme: "Программа",
  programmeStructure: "Структура программы",
  contents: "Содержание",
  markDone: "Отметить пройденным",
  unmarkDone: "Снять отметку",
  checkYourself: "Проверь себя",
  backToProgramme: "← К программе",
  adjacentLessons: "Соседние уроки",
  previous: "Предыдущий",
  next: "Следующий",
  quizQuestions: "Вопросов: {n}",
  quizzes: "Квизы",
  quizzesIntro:
    "Любой квиз можно пройти в любой момент, читать статью для этого не нужно. Лучший результат сохраняется.",
  noQuizzes: "Квизов пока нет.",
  optionTrue: "Верно",
  optionFalse: "Неверно",
  correct: "Верно!",
  incorrect: "Неверно",
  rightAnswer: "Верный ответ:",
  answerOptions: "Варианты ответа",
  orderThem: "Расставь по порядку",
  moveUp: "Поднять: {item}",
  moveDown: "Опустить: {item}",
  chooseMatch: "Выбери соответствие",
  quizProgress: "Прогресс квиза",
  question: "Вопрос",
  questionOf: "Вопрос {n} из {total}",
  retryMode: "повтор ошибок",
  check: "Проверить",
  nextQuestion: "Дальше",
  finish: "Завершить",
  result: "Результат: {score} из {total}",
  mistakes: "Ошибки",
  retryMistakes: "Повторить ошибки",
  retryAll: "Пройти заново",
  allQuizzes: "← Все квизы",
  sourceLink: "оригинал на Hello Interview",
  translation: "перевод",
  bestResult: "лучший результат {score} из {total}",
  notSynced: "не синхронизировано",
  materialLanguage: "Язык материала",
  notFound: "Страница не найдена",
} as const;

export type Key = keyof typeof ru;

const en: Record<Key, string> = {
  siteName: "devplus",
  programme: "Programme",
  programmeStructure: "Programme structure",
  contents: "Contents",
  markDone: "Mark as done",
  unmarkDone: "Unmark",
  checkYourself: "Check yourself",
  backToProgramme: "← Back to the programme",
  adjacentLessons: "Adjacent lessons",
  previous: "Previous",
  next: "Next",
  quizQuestions: "{n} questions",
  quizzes: "Quizzes",
  quizzesIntro:
    "You can take any quiz at any time, no need to read the article first. Your best result is saved.",
  noQuizzes: "No quizzes yet.",
  optionTrue: "True",
  optionFalse: "False",
  correct: "Correct!",
  incorrect: "Incorrect",
  rightAnswer: "Correct answer:",
  answerOptions: "Answer options",
  orderThem: "Put in order",
  moveUp: "Move up: {item}",
  moveDown: "Move down: {item}",
  chooseMatch: "Choose a match",
  quizProgress: "Quiz progress",
  question: "Question",
  questionOf: "Question {n} of {total}",
  retryMode: "retrying mistakes",
  check: "Check",
  nextQuestion: "Next",
  finish: "Finish",
  result: "Result: {score} of {total}",
  mistakes: "Mistakes",
  retryMistakes: "Retry mistakes",
  retryAll: "Start over",
  allQuizzes: "← All quizzes",
  sourceLink: "original on Hello Interview",
  translation: "translation",
  bestResult: "best result {score} of {total}",
  notSynced: "not synced",
  materialLanguage: "Material language",
  notFound: "Page not found",
};

export const dictionary: Record<Lang, Record<Key, string>> = { ru, en };

export const t = (lang: Lang, key: Key): string => dictionary[lang][key];

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));
