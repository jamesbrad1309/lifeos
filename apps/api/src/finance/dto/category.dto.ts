import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(16).nullable().optional(),
  kind: z.enum(["expense", "income"]).default("expense"),
  aliases: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(50).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const dismissPresetSuggestionSchema = z.object({
  /** "amountMinor|label", as QuickLogService.presetKey builds it. */
  key: z.string().min(1).max(250),
});
export type DismissPresetSuggestionInput = z.infer<typeof dismissPresetSuggestionSchema>;
