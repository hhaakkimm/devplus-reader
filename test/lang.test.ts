import { describe, expect, it } from "vitest";
import { pickLang } from "@/lib/lang";

describe("pickLang", () => {
  it("prefers the stored choice", () => {
    expect(pickLang({ stored: "en" })).toBe("en");
    expect(pickLang({ stored: "ru", tg: "en", nav: ["en-US"] })).toBe("ru");
  });

  it("skips an invalid stored value and falls through to Telegram", () => {
    expect(pickLang({ stored: "de", tg: "en-US" })).toBe("en");
    // Only lower case ru|en is a stored choice.
    expect(pickLang({ stored: "EN", tg: "ru" })).toBe("ru");
    expect(pickLang({ stored: "", nav: ["en"] })).toBe("en");
    expect(pickLang({ stored: null, nav: ["en"] })).toBe("en");
  });

  it("takes the Telegram language by the prefix before '-'", () => {
    expect(pickLang({ tg: "ru" })).toBe("ru");
    expect(pickLang({ tg: "en-GB", nav: ["ru"] })).toBe("en");
    // shortcut under test: only '-' separates, Telegram sends plain IETF codes
    expect(pickLang({ tg: "en_US", nav: ["ru"] })).toBe("ru");
  });

  it("skips an unsupported Telegram language", () => {
    expect(pickLang({ tg: "de", nav: ["en-GB"] })).toBe("en");
  });

  it("takes the first supported browser language", () => {
    expect(pickLang({ nav: ["de-DE", "en-GB"] })).toBe("en");
    expect(pickLang({ nav: ["ru-RU", "en-GB"] })).toBe("ru");
    expect(pickLang({ nav: ["EN-us"] })).toBe("en");
  });

  it("defaults to ru", () => {
    expect(pickLang({})).toBe("ru");
    expect(pickLang({ nav: [] })).toBe("ru");
    expect(pickLang({ nav: ["de-DE", "fr"] })).toBe("ru");
    expect(pickLang({ stored: "de", tg: "xx", nav: ["fr"] })).toBe("ru");
  });
});
