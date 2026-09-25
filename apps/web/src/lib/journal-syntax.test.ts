import { describe, expect, it } from "vitest";
import type { JournalEntry } from "#graphql/types";
import { parseJournalText, serializeEntry, suggestionsAt } from "#lib/journal-syntax";

const one = (source: string) => {
  const { items, issues } = parseJournalText(source);
  return { item: items[0], issues };
};

describe("parseJournalText: English, as before", () => {
  it("parses each kind with its tokens", () => {
    expect(one("- /action went for a walk 20m @7:30 #health").item).toMatchObject({
      kind: "ACTION",
      text: "went for a walk #health",
      durationMinutes: 20,
      time: "07:30",
    });
    expect(one("- /feeling anxious 4/5 big meeting").item).toMatchObject({
      kind: "FEELING",
      emotion: "anxious",
      intensity: 4,
      text: "big meeting",
    });
    expect(one("- /event deadline moved (-)").item).toMatchObject({
      kind: "EVENT",
      tone: "NEGATIVE",
    });
  });

  it("nests feelings under an event", () => {
    const { items } = parseJournalText("- /event deadline moved\n  - /feeling stressed");
    expect(items[1].triggerIndex).toBe(0);
  });

  it("keeps an unknown emotion word as typed", () => {
    expect(one("/feeling wistful").item.emotion).toBe("wistful");
  });

  it("reports problems as codes, with the word that was used", () => {
    expect(one("/action 20m").issues).toEqual([
      { line: 0, code: "actionNeedsText", params: { command: "action" } },
    ]);
    expect(one("/dance around").issues[0]).toMatchObject({
      code: "unknownCommand",
      params: { word: "dance" },
    });
    expect(one("- just text").issues[0]).toMatchObject({ code: "needsCommand" });
    expect(one("/action x @25:00").issues[0]).toMatchObject({
      code: "invalidTime",
      params: { token: "@25:00" },
    });
  });
});

describe("parseJournalText: Vietnamese", () => {
  it.each([
    ["/làm đi dạo 20m", "ACTION"],
    ["/lam đi dạo 20m", "ACTION"],
    ["/cảm vui", "FEELING"],
    ["/sựkiện mất điện", "EVENT"],
    ["/sukien mất điện", "EVENT"],
    ["/Sự-kiện mất điện", "EVENT"],
  ])("%s → %s", (source, kind) => {
    expect(one(source).item.kind).toBe(kind);
  });

  it("stores Vietnamese emotion phrases under their English key", () => {
    expect(one("/cảm lo âu 4/5 vì buổi họp").item).toMatchObject({
      emotion: "anxious",
      intensity: 4,
      text: "vì buổi họp",
    });
    expect(one("/cam lo au").item.emotion).toBe("anxious");
    expect(one("/cảm tràn đầy năng lượng sau khi chạy").item).toMatchObject({
      emotion: "energized",
      text: "sau khi chạy",
    });
    // English emotions still work after a Vietnamese command, and vice versa.
    expect(one("/cảm grateful").item.emotion).toBe("grateful");
    expect(one("/feeling biết ơn").item.emotion).toBe("grateful");
  });

  it("reports the command as the user wrote it", () => {
    expect(one("/làm 20m").issues[0]).toMatchObject({
      code: "actionNeedsText",
      params: { command: "làm" },
    });
  });
});

describe("serializeEntry round-trips in either language", () => {
  const feeling = {
    kind: "FEELING",
    emotion: "anxious",
    intensity: 4,
    text: "big meeting",
    durationMinutes: null,
    tone: null,
    time: "09:30",
  } as unknown as JournalEntry;

  it.each(["en", "vi"] as const)("%s", (language) => {
    const line = serializeEntry(feeling, language);
    expect(line).toBe(
      language === "en"
        ? "/feeling anxious 4/5 big meeting @09:30"
        : "/cảm lo âu 4/5 big meeting @09:30",
    );
    expect(one(line).item).toMatchObject({
      kind: "FEELING",
      emotion: "anxious",
      intensity: 4,
      time: "09:30",
    });
  });
});

describe("suggestionsAt", () => {
  it("offers commands in the chosen language", () => {
    const vi = suggestionsAt("- /", 3, "vi");
    expect(vi?.items.map((i) => i.label)).toEqual(["làm", "cảm", "sựkiện"]);
    expect(suggestionsAt("- /s", 4, "vi")?.items.map((i) => i.label)).toEqual(["sựkiện"]);
  });

  it("offers emotions by their name in the chosen language, accents optional", () => {
    const value = "/cảm lo";
    const s = suggestionsAt(value, value.length, "vi");
    expect(s?.items.map((i) => i.label)).toContain("lo âu");
    expect(s?.items[0].insert.endsWith(" ")).toBe(true);
    expect(suggestionsAt("/feeling anx", 12, "en")?.items.map((i) => i.label)).toEqual(["anxious"]);
  });
});
