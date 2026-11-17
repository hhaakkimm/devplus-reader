import { describe, expect, it } from "vitest";
import {
  MAX_VALUE,
  isDone,
  joinDone,
  mark,
  mergeDone,
  mergeQuiz,
  parseScore,
  splitDone,
  type Done,
} from "@/lib/progress/merge";

describe("mergeDone", () => {
  it("lets an un-mark on the later device B win over a mark on A", () => {
    expect(mergeDone({ a: 100 }, { a: -200 })).toEqual({ a: -200 });
  });

  it("lets a mark on the later device A win over an un-mark on B", () => {
    expect(mergeDone({ a: 300 }, { a: -200 })).toEqual({ a: 300 });
  });

  it("keeps slugs that only one side knows, including unknown ones", () => {
    expect(mergeDone({ a: 1 }, { ghost: 7, b: -3 })).toEqual({
      a: 1,
      ghost: 7,
      b: -3,
    });
  });

  it("prefers the positive value on a tie of |t|", () => {
    expect(mergeDone({ a: -50 }, { a: 50 })).toEqual({ a: 50 });
    expect(mergeDone({ a: 50 }, { a: -50 })).toEqual({ a: 50 });
  });

  it("takes the timestamps as-is when the device clocks disagree", () => {
    // B's clock is far behind: its newer un-mark loses, nothing is "fixed".
    expect(mergeDone({ a: 1000 }, { a: -10 })).toEqual({ a: 1000 });
  });
});

describe("isDone", () => {
  it("is true only for a positive timestamp", () => {
    expect(isDone({ a: 5 }, "a")).toBe(true);
    expect(isDone({ a: -5 }, "a")).toBe(false);
    expect(isDone({}, "a")).toBe(false);
  });
});

describe("mark", () => {
  it("writes +now or -now", () => {
    expect(mark({}, "a", true, 10)).toEqual({ a: 10 });
    expect(mark({ a: 10 }, "a", false, 20)).toEqual({ a: -20 });
  });

  it("bumps |t| past the old one when now is not later", () => {
    expect(mark({ a: 100 }, "a", false, 50)).toEqual({ a: -101 });
    expect(mark({ a: -100 }, "a", true, 100)).toEqual({ a: 101 });
  });

  it("does not mutate its input", () => {
    const d: Done = { a: 1 };
    mark(d, "a", false, 5);
    expect(d).toEqual({ a: 1 });
  });
});

describe("parseScore / mergeQuiz", () => {
  it("parses score/total and rejects garbage", () => {
    expect(parseScore("3/5")).toEqual({ score: 3, total: 5 });
    expect(parseScore("a/b")).toBeNull();
    expect(parseScore("5/0")).toBeNull();
    expect(parseScore("6/5")).toBeNull();
    expect(parseScore("")).toBeNull();
  });

  it("takes the larger share", () => {
    expect(mergeQuiz("3/5", "4/5")).toBe("4/5");
    expect(mergeQuiz("3/5", "1/1")).toBe("1/1");
    expect(mergeQuiz("4/5", "3/5")).toBe("4/5");
  });

  it("ignores invalid values", () => {
    expect(mergeQuiz("3/5", "мусор")).toBe("3/5");
    expect(mergeQuiz("мусор", "3/5")).toBe("3/5");
    expect(mergeQuiz("x", "y")).toBeUndefined();
    expect(mergeQuiz(undefined, undefined)).toBeUndefined();
    expect(mergeQuiz(undefined, "2/3")).toBe("2/3");
  });

  it("keeps the first on equal shares", () => {
    expect(mergeQuiz("1/2", "2/4")).toBe("1/2");
  });
});

describe("splitDone / joinDone", () => {
  const big = (n: number): Done =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `${String(i).padStart(3, "0")}-${"x".repeat(36)}`,
        1_700_000_000 + i,
      ]),
    );

  it("splits 100 slugs x 40 chars into values <= 4096 and round-trips", () => {
    const x = big(100);
    const parts = splitDone("01-m", x);
    expect(Object.keys(parts).length).toBeGreaterThan(1);
    for (const v of Object.values(parts)) {
      expect(v.length).toBeLessThanOrEqual(MAX_VALUE);
    }
    expect(Object.keys(parts)).toEqual(
      expect.arrayContaining(["done-01-m", "done-01-m-2"]),
    );
    expect(joinDone("01-m", parts)).toEqual(x);
  });

  it("names chunks done-<m>, done-<m>-2, done-<m>-3, ... and still splits past 3", () => {
    const x = big(400);
    const parts = splitDone("m", x);
    const keys = Object.keys(parts);
    expect(keys.length).toBeGreaterThan(3);
    expect(keys).toEqual(
      keys.map((_, i) => (i === 0 ? "done-m" : `done-m-${i + 1}`)),
    );
    expect(joinDone("m", parts)).toEqual(x);
  });

  it("gives a single chunk for a small object and for an empty one", () => {
    expect(splitDone("m", { a: 1 })).toEqual({ "done-m": '{"a":1}' });
    expect(splitDone("m", {})).toEqual({ "done-m": "{}" });
  });

  it("joinDone ignores garbage chunks and other modules' keys", () => {
    expect(
      joinDone("m", {
        "done-m": "not json",
        "done-m-2": '{"b":2}',
        "done-m-3": "[1]",
        "done-m-4": '{"c":"x"}',
        "done-other": '{"z":9}',
        "done-m-x": '{"y":1}',
      }),
    ).toEqual({ b: 2 });
  });
});
