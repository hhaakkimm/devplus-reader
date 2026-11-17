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
  quizQuestions: "вопросов {n}",
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
  bestResult: "best result {score} of {total}",
  notSynced: "not synced",
  materialLanguage: "Material language",
  notFound: "Page not found",
};

export const dictionary: Record<Lang, Record<Key, string>> = { ru, en };

export const t = (lang: Lang, key: Key): string => dictionary[lang][key];

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));
