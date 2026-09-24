import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { JournalEntry, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { CreateJournalEntriesInput, JournalEntryInput } from "#journal/dto/journal-entry.dto";

const log = scopedLogger("JournalService");

/** Widest range `/journal-entries/days` serves — a month view plus padding. */
const MAX_SUMMARY_DAYS = 62;

const withTrigger = {
  trigger: { select: { id: true, kind: true, text: true, time: true } },
} satisfies Prisma.JournalEntryInclude;

export type JournalEntryWithTrigger = Prisma.JournalEntryGetPayload<{
  include: typeof withTrigger;
}>;

export interface JournalDaySummary {
  date: string;
  actionCount: number;
  feelingCount: number;
  eventCount: number;
  /** Emotion words logged that day, in time order — the frontend maps them to emoji/valence. */
  emotions: string[];
}

/** "Standup ran late #work #Team" → ["work", "team"]. */
export function extractTags(text: string): string[] {
  const tags = [...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)];
}

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  findForDate(date: string): Promise<JournalEntryWithTrigger[]> {
    return this.prisma.journalEntry.findMany({
      where: { date: new Date(date) },
      include: withTrigger,
      orderBy: [{ time: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
  }

  async summarize(from: string, to: string): Promise<JournalDaySummary[]> {
    const start = new Date(from);
    const end = new Date(to);
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (days < 0 || days > MAX_SUMMARY_DAYS) {
      throw new BadRequestException(`from..to must span 0–${MAX_SUMMARY_DAYS} days`);
    }

    const entries = await this.prisma.journalEntry.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true, kind: true, emotion: true },
      orderBy: [{ date: "asc" }, { time: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });

    const byDate = new Map<string, JournalDaySummary>();
    for (const entry of entries) {
      const date = entry.date.toISOString().slice(0, 10);
      let day = byDate.get(date);
      if (!day) {
        day = { date, actionCount: 0, feelingCount: 0, eventCount: 0, emotions: [] };
        byDate.set(date, day);
      }
      if (entry.kind === "ACTION") day.actionCount++;
      if (entry.kind === "EVENT") day.eventCount++;
      if (entry.kind === "FEELING") {
        day.feelingCount++;
        if (entry.emotion) day.emotions.push(entry.emotion);
      }
    }
    return [...byDate.values()];
  }

  async create(input: JournalEntryInput): Promise<JournalEntryWithTrigger> {
    await this.assertValidTrigger(input.triggerId);
    const entry = await this.prisma.journalEntry.create({
      data: toColumns(input),
      include: withTrigger,
    });
    log.info(
      { journalEntryId: entry.id, kind: entry.kind, date: input.date },
      "journal entry created",
    );
    return entry;
  }

  /**
   * Saves a whole composer list in one transaction, so a failure (or a
   * retry after one) never leaves half a list behind. Items are created in
   * order, which lets `triggerIndex` resolve to an event created earlier.
   */
  async createMany(drafts: CreateJournalEntriesInput): Promise<JournalEntryWithTrigger[]> {
    drafts.forEach((draft, i) => {
      if (draft.triggerIndex == null) return;
      const parent = drafts[draft.triggerIndex];
      if (draft.triggerIndex >= i || parent?.kind !== "EVENT" || draft.kind === "EVENT") {
        throw new BadRequestException(
          `entries[${i}].triggerIndex must point at an earlier EVENT, from an ACTION or FEELING`,
        );
      }
    });
    for (const draft of drafts) {
      if (draft.triggerIndex == null) await this.assertValidTrigger(draft.triggerId);
    }

    const entries = await this.prisma.$transaction(async (tx) => {
      const created: JournalEntryWithTrigger[] = [];
      for (const draft of drafts) {
        const triggerId =
          draft.triggerIndex == null ? draft.triggerId : created[draft.triggerIndex].id;
        created.push(
          await tx.journalEntry.create({
            data: toColumns({ ...draft, triggerId }),
            include: withTrigger,
          }),
        );
      }
      return created;
    });
    log.info({ count: entries.length, date: drafts[0].date }, "journal entries created");
    return entries;
  }

  async replace(id: string, input: JournalEntryInput): Promise<JournalEntryWithTrigger> {
    await this.findOneOrFail(id);
    if (input.triggerId === id) {
      throw new BadRequestException("An entry can't be its own trigger");
    }
    await this.assertValidTrigger(input.triggerId);
    const entry = await this.prisma.journalEntry.update({
      where: { id },
      data: toColumns(input),
      include: withTrigger,
    });
    log.info({ journalEntryId: id, kind: entry.kind }, "journal entry updated");
    return entry;
  }

  async remove(id: string): Promise<JournalEntry> {
    await this.findOneOrFail(id);
    // Entries it triggered keep existing; their triggerId is nulled by the FK.
    const entry = await this.prisma.journalEntry.delete({ where: { id } });
    log.info({ journalEntryId: id }, "journal entry deleted");
    return entry;
  }

  private async findOneOrFail(id: string): Promise<JournalEntry> {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    return entry;
  }

  private async assertValidTrigger(triggerId: string | null | undefined): Promise<void> {
    if (!triggerId) return;
    const trigger = await this.prisma.journalEntry.findUnique({ where: { id: triggerId } });
    if (trigger?.kind !== "EVENT") {
      throw new BadRequestException("triggerId must reference an existing EVENT entry");
    }
  }
}

/**
 * Maps the validated input onto every column, nulling the ones that don't
 * belong to its kind — so switching an entry from FEELING to EVENT on edit
 * can't leave a stale emotion behind.
 */
function toColumns(input: JournalEntryInput) {
  return {
    date: new Date(input.date),
    kind: input.kind,
    time: input.time ?? null,
    text: input.text,
    tags: extractTags(input.text),
    triggerId: input.kind === "EVENT" ? null : (input.triggerId ?? null),
    durationMinutes: input.kind === "ACTION" ? (input.durationMinutes ?? null) : null,
    emotion: input.kind === "FEELING" ? input.emotion : null,
    intensity: input.kind === "FEELING" ? input.intensity : null,
    tone: input.kind === "EVENT" ? (input.tone ?? null) : null,
  };
}
