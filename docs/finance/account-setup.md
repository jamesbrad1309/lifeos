# Account Setup ("Money setup")

One screen where the user configures everything money lives in: bank
accounts, credit cards (with limits), loans and personal debts, and cash.
You set this up once and rarely touch it again, so it can be thorough.
Logging, by contrast, has to be fast (see [quick-log.md](quick-log.md)).

Single user in v1, like the rest of LifeOS: there's no `User` entity, and
every account belongs to the one person using the app.

## Account types and what each one asks for

| Type | Examples | Required | Optional extras |
| ---- | -------- | -------- | --------------- |
| **Bank account** (`CURRENT`, `SAVINGS`) | Monzo current, ISA | name, current balance | institution, last 4 digits, colour/icon |
| **Credit card** (`CREDIT_CARD`) | Amex, Barclaycard | name, **credit limit**, amount currently owed | last 4, **statement day**, **payment due day**, APR, minimum payment |
| **Loan** (`LOAN`) | Car loan, student loan, BNPL | name, amount still owed | APR, **monthly payment**, lender, start date, term |
| **Personal debt** (`IOU`) | "I owe Sam £40", "Alex owes me £25" | person, amount, direction | due date, note |
| **Cash / wallet** (`CASH`) | Wallet, PayPal, gift card | name, current balance | — |
| **Investment** (`INVESTMENT`) | Pension, S&S ISA | name, current value | institution |

Each form shows only its type's fields. The fields a user is asked for
during setup are the ones marked "required" above.

## Start from today's balance, not from history

The biggest mistake finance apps make at onboarding is asking for past
transactions. Instead, ask for **the balance right now**:

- It's stored as `openingBalanceMinor` + `openingBalanceDate` (today).
- Tracking starts from that date. Nothing before it needs to be entered.
- For cards and loans the user types **how much they owe** as a positive
  number, and the app stores it as negative (see the sign convention in
  [money-handling.md](money-handling.md)). Never make users type a minus
  sign.

## Reconcile instead of perfect logging

Users will forget to log things, so the app must make that painless.

- Every account has **"Update balance"**. The user types the real balance
  from their banking app, and the app creates one **balance adjustment**
  transaction for the difference, in a built-in "Adjustment" category that
  reports ignore.
- The account then shows "Last reconciled 3 days ago", which nudges the
  user gently without asking them to log every transaction.

This is what makes the quick log optional: logging gives detail, and
reconciling keeps the numbers correct.

## What the screen shows

```
┌ Money setup ─────────────────────────────── [+ Add] ┐
│ NET WORTH  £12,480        Assets £31,200 · Owed £18,720 │
│                                                      │
│ BANK ACCOUNTS                                        │
│  ● Monzo Current ··4821          £1,204.33  default  │
│  ● Marcus Savings                £9,850.00           │
│                                                      │
│ CREDIT CARDS                                         │
│  ● Amex ··1009      owe £640 of £5,000  ▓▓░░░░ 13%   │
│    Statement 18th · Due 8 Oct (in 14 days)           │
│                                                      │
│ LOANS & DEBTS                                        │
│  ● Car loan         £8,300 left · £310/mo · paid off Jun 2029 │
│  ● Sam (IOU)        you owe £40                      │
│                                                      │
│ CASH                                                 │
│  ● Wallet                        £35.00              │
└──────────────────────────────────────────────────────┘
```

- **Credit cards** show a utilisation bar. Above 30% is amber and above
  75% is red; those are common credit-score guidance thresholds.
- **"Due in N days"** turns amber within 7 days of the payment due day.
- **Loans** show an estimated payoff date calculated from the balance, APR
  and monthly payment (formula below).
- **Default account** (star icon): the account quick log uses unless told
  otherwise. Exactly one account is the default.
- Drag to reorder. The order matters because quick log's account switcher
  follows it.

## Derived values (computed, never stored)

| Value | Formula |
| ----- | ------- |
| Balance | `openingBalanceMinor + SUM(transactions since openingBalanceDate)` |
| Owed on card / loan | `-balance` when the balance is negative |
| Available credit | `creditLimitMinor + balance` (balance is negative when owing) |
| Utilisation | `owed / creditLimitMinor` |
| Next due date | Next occurrence of `paymentDueDay` after today, clamped to month length |
| Current statement spend | Card outflows since the last `statementDay` |
| Loan payoff (months) | `n = −ln(1 − r·P/A) / ln(1 + r)`, where `r` = APR/12, `P` = owed, `A` = monthly payment. If `A ≤ r·P` the loan never pays off, so show "payment doesn't cover interest" |

## Paying a card or loan

"Pay off card" is a **transfer** from a bank account to the card (see
transfers in [data-model.md](data-model.md)). It isn't spending, because
the spending already happened when the card was used. The same applies to
loan repayments. Splitting a repayment into principal and interest is out
of scope for v1. Model it as a transfer, and optionally log the interest
separately as an expense in an "Interest" category.

## Personal debts (IOUs)

These cover the common case "I paid for dinner, Sam owes me £25":

- An `IOU` account per person, with a positive balance when they owe you
  and negative when you owe them.
- **Settle up** is a transfer between the IOU account and a real account
  when money actually changes hands.
- Quick log can split an expense into "my share" and "Sam owes me" in one
  step. This is a follow-up; see [quick-log.md](quick-log.md).
