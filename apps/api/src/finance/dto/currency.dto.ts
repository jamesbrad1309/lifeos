import { z } from "zod";

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "code must be a 3-letter ISO 4217 code");

export const addCurrencySchema = z.object({ code: currencyCode });
export type AddCurrencyInput = z.infer<typeof addCurrencySchema>;

export const setOverrideSchema = z.object({
  /** Main-currency units per 1 unit of this currency; null goes back to the fetched rate. */
  rateToMain: z.number().positive().finite().nullable(),
});
export type SetOverrideInput = z.infer<typeof setOverrideSchema>;
