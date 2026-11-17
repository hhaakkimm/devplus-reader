import type { Lang } from "@/lib/i18n";

// The "How to use" page: a heading, optional paragraphs and an optional list per section.
export type GuideSection = { title: string; text?: string[]; items?: string[] };
export type Guide = { intro: string; sections: GuideSection[] };

const ru: Guide = {
  intro:
    "Читалка программы devplus: уроки и квизы по system design и смежным темам. Ниже коротко, как открыть, читать и сохранять прогресс.",
  sections: [
    {
      title: "Как открыть",
      items: [
        "В Telegram: открой чат с ботом и нажми кнопку «DevPlus» слева от поля ввода.",
        "В браузере: просто открой ссылку на сайт. Telegram и вход не нужны.",
        "Кнопка «Назад» вверху Telegram возвращает на программу. В браузере для этого есть «← К программе» и обычная кнопка «Назад».",
      ],
    },
    {
      title: "Программа и уроки",
      text: [
        "Программа состоит из модулей, модуль из уроков. Модуль это тема, а не обязательный шаг: можно открывать в любом порядке, но основы лучше пройти раньше сложного.",
        "На главной у каждого модуля счётчик «N из M»: сколько уроков ты отметил. Длинные модули свёрнуты, нажми на название, чтобы открыть список.",
        "В уроке сверху оглавление, внизу «Соседние уроки» (предыдущий и следующий). Если у урока есть квиз, под текстом будет блок «Проверь себя».",
      ],
    },
    {
      title: "Отметки о прохождении",
      text: [
        "Под уроком кнопка «Отметить пройденным», после нажатия она становится «Снять отметку». Платформа не проверяет, понял ли ты материал: отметку ставишь сам, честнее всего после квиза.",
      ],
      items: [
        "В Telegram отметки хранятся в твоём Telegram и видны на всех устройствах, где ты открываешь читалку через бота.",
        "В обычном браузере отметки лежат только на этом устройстве и в этом браузере. Если очистить данные сайта, они пропадут.",
        "Надпись «не синхронизировано» вверху значит, что облако Telegram недоступно. Отметки при этом сохранены на устройстве.",
      ],
    },
    {
      title: "Квизы",
      text: [
        "Раздел «Квизы» в шапке. Любой квиз можно пройти сразу, читать статью для этого не нужно.",
        "Вопросы бывают четырёх видов: выбор ответа, «Верно/Неверно», сопоставление (выбери пару в списке) и расстановка по порядку (кнопки ↑ и ↓). Нажми «Проверить», получишь разбор, потом «Дальше».",
        "В конце видно результат и ошибки, их можно повторить. Сохраняется лучший результат.",
      ],
    },
    {
      title: "Язык и источник",
      text: [
        "Переключатель RU/EN есть вверху страницы. Английская версия есть не у всех уроков и квизов: там, где её нет, остаётся русская.",
        "Уроки и квизы это перевод материалов Hello Interview, ссылка на оригинал есть рядом с материалом.",
      ],
    },
  ],
};

const en: Guide = {
  intro:
    "A reader for the devplus programme: lessons and quizzes on system design and related topics. A short guide to opening it, reading and saving your progress.",
  sections: [
    {
      title: "How to open it",
      items: [
        "In Telegram: open the chat with the bot and tap the “DevPlus” button to the left of the message field.",
        "In a browser: just open the site link. No Telegram or sign-in needed.",
        "The Back button at the top of Telegram returns to the programme. In a browser use “← Back to the programme” or the browser's own Back button.",
      ],
    },
    {
      title: "Programme and lessons",
      text: [
        "The programme is made of modules, a module of lessons. A module is a topic, not a required step: open them in any order, but cover the basics before the hard parts.",
        "On the home page every module has an “N of M” counter: how many lessons you have marked. Long modules are collapsed, tap the title to open the list.",
        "A lesson has a table of contents at the top and “Adjacent lessons” (previous and next) at the bottom. If the lesson has a quiz, there is a “Check yourself” block under the text.",
      ],
    },
    {
      title: "Marking lessons as done",
      text: [
        "Under a lesson there is a “Mark as done” button, which turns into “Unmark” once pressed. The reader does not check that you understood the material: you mark it yourself, best after the quiz.",
      ],
      items: [
        "In Telegram, marks are stored in your Telegram and show up on every device where you open the reader through the bot.",
        "In a regular browser, marks live only on this device and in this browser. Clearing the site data erases them.",
        "“not synced” at the top means Telegram cloud storage is unavailable. Your marks are still saved on the device.",
      ],
    },
    {
      title: "Quizzes",
      text: [
        "The “Quizzes” section is in the header. You can take any quiz right away, no need to read the article first.",
        "There are four kinds of questions: choice, True/False, matching (pick a pair in a list) and ordering (the ↑ and ↓ buttons). Press “Check” to see the explanation, then “Next”.",
        "At the end you see the result and your mistakes, which you can retry. The best result is saved.",
      ],
    },
    {
      title: "Language and source",
      text: [
        "The RU/EN toggle is at the top of the page. Not every lesson and quiz has an English version: where it is missing, the Russian one stays.",
        "Lessons and quizzes are translations of Hello Interview material, with a link to the original next to it.",
      ],
    },
  ],
};

export const guide: Record<Lang, Guide> = { ru, en };
