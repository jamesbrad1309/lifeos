# Finance Use Cases

Uses the same format as the habit [use cases](../domain/use-cases.md).
**Impact score** (1–5): `5` core loop · `4` used daily or weekly ·
`3` meaningfully improves UX · `2` edge case / power user · `1` speculative.
Nothing is built yet, so every box is unchecked.

## Accounts

- [ ] **Create an account** (name, type: current / savings / credit card / cash / investment, opening balance) — Impact 5
- [ ] **See each account's current balance** — Impact 5
  → Derived from opening balance + transactions, see [data-model.md](data-model.md)
- [ ] **Net worth**: assets minus liabilities across all accounts — Impact 4
- [ ] **Archive a closed account** and keep its history — Impact 2

## Transactions

- [ ] **Log an expense or income** (amount, date, payee, category, note) — Impact 5
- [ ] **Quick-add from the dashboard** in two taps: amount + category — Impact 4
- [ ] **Edit or delete a transaction** — Impact 4
- [ ] **Transfer between accounts** without it counting as spending — Impact 4
- [ ] **Split a transaction** across categories (e.g. one supermarket receipt covering groceries and household) — Impact 2
- [ ] **Search and filter** by date range, account, category, payee or text — Impact 3
- [ ] **Tag transactions** ("holiday-2026", "work-expense") alongside the category — Impact 2

## Categories

- [ ] **Default category set** seeded on first run (Groceries, Rent, Transport, Eating out…) — Impact 4
- [ ] **Custom categories** with icon and colour, grouped under parents ("Food › Eating out") — Impact 3
- [ ] **Auto-categorise by payee rule** ("TESCO*" → Groceries) — Impact 3

## Budgets

- [ ] **Monthly budget per category** — Impact 4
- [ ] **Budget vs actual** progress bars, coloured by pace ("68% spent, 50% of the month gone") — Impact 4
- [ ] **Rollover**: carry unspent budget into next month — Impact 2
- [ ] **Alert when a category passes 80% / 100%** — Impact 2 (in-app only; notifications are out of scope)

## Recurring & bills

- [ ] **Recurring transactions** (rent, salary, subscriptions) generated on schedule — Impact 4
- [ ] **Upcoming bills** for the next 30 days — Impact 3
- [ ] **Subscription audit**: list every recurring expense with its yearly cost — Impact 3

## Savings goals

- [ ] **Create a goal** (target amount, optional deadline, linked account) — Impact 3
- [ ] **Track progress** with "on track / behind" based on the deadline — Impact 3
- [ ] **Required monthly saving** to reach the goal on time — Impact 2

## Reports & insights

- [ ] **Spend by category this month** (donut or bar chart) — Impact 4
- [ ] **Cash flow**: income vs expenses per month for the last 12 months — Impact 4
- [ ] **Month-over-month change per category** ("Eating out +42%") — Impact 3
- [ ] **Top payees** — Impact 2
- [ ] **Net worth over time** — Impact 2

## Data in / out

- [ ] **CSV import** from a bank export with column mapping and duplicate detection — Impact 4
- [ ] **CSV export** of transactions — Impact 2

## Out of scope for v1

- Live bank sync (Open Banking / Plaid)
- Multiple currencies with FX conversion
- Investment holdings, prices and portfolio performance
- Tax reporting, invoices, shared or household budgets
