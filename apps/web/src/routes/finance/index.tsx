import { createFileRoute, redirect } from "@tanstack/react-router";

// Accounts is the only finance screen so far. When the overview (net worth,
// cash flow) exists it lives here, and this redirect goes.
export const Route = createFileRoute("/finance/")({
  beforeLoad: () => {
    throw redirect({ to: "/finance/accounts", replace: true });
  },
});
