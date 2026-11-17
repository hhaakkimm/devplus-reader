import { loadCurriculum } from "@/lib/content";
import { loadQuizCatalog } from "@/lib/quizzes";

// Every page of the build needs the whole curriculum and reading ~280 files per page is slow:
// read once per process. shortcut: stale under `next dev` after content edits, restart the dev server.
let curriculum: ReturnType<typeof loadCurriculum> | undefined;
export const getCurriculum = () => (curriculum ??= loadCurriculum());

let quizCatalog: ReturnType<typeof loadQuizCatalog> | undefined;
export const getQuizCatalog = () => (quizCatalog ??= loadQuizCatalog());
