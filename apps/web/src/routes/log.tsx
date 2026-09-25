import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { openQuickLog } from "#hooks/useQuickLog";

/**
 * `/log?amount=3.40&category=coffee`: a deep link for home-screen and Siri
 * shortcuts. It opens the quick-log sheet over the dashboard, filled in.
 */
export const Route = createFileRoute("/log")({
  validateSearch: z.object({
    // The router JSON-parses search values, so `amount=3.40` arrives as 3.4.
    amount: z.coerce
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional()
      .catch(undefined),
    category: z.string().max(40).optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    openQuickLog({ amount: search.amount, category: search.category });
    throw redirect({ to: "/habits", replace: true });
  },
});
