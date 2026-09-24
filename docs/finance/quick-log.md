# Quick Log: Logging an Expense in Under 5 Seconds

Logging every coffee, bus fare and lunch is the most tedious part of
personal finance. It's the main reason people stop using budgeting apps.
Every decision here is about removing taps.

**Target:** a typical expense takes **amount + 1 tap**, under 5 seconds from
opening the app.

## The core flow

```
tap ➕  →  type 3.40  →  tap ☕ Coffee  →  saved ✓ (Undo)
```

That's the whole thing. There's no Save button: **tapping a category
saves**. Everything else has a sensible default:

| Field | Default | How to change it |
| ----- | ------- | ---------------- |
| Amount | Keypad is focused on open | — |
| Expense or income | Expense | "+ Income" toggle (rarely needed) |
| Category | Suggested chips (see below) | Tap a chip. "More…" opens the full list |
| Account | The **default account** from [account-setup.md](account-setup.md) | Account pill above the keypad; the app remembers the last one per category |
| Date | Today | "Yesterday" chip, or the date pill |
| Payee / note | Empty | Optional text field, collapsed |

## Wireframe

```
┌───────────────────────────────┐
│  Monzo ▾        Today ▾   ✕   │   ← account & date pills (rarely touched)
│                               │
│            £3.40              │   ← big amount, keypad already open
│  [ note / payee… ]            │   ← optional, collapsed
│                               │
│  ☕ Coffee   🍔 Lunch   🚌 Bus  │   ← suggested categories: tap = save
│  🛒 Groceries  🍺 Drinks  ⋯More │
│                               │
│  ⭐ Presets: ☕ Flat white £3.40 │   ← one tap, no typing at all
│              🚇 Tube £2.80     │
├───────────────────────────────┤
│   1   2   3                   │
│   4   5   6                   │
│   7   8   9                   │
│   .   0   ⌫                   │
└───────────────────────────────┘
```

## Five things that remove most of the effort

### 1. Presets (zero typing)

People spend the same amounts in the same places again and again. A
**preset** is a saved `(label, emoji, amount?, category, account?)`:

- With an amount set, **one tap logs it**: "☕ Flat white £3.40".
- Without an amount, tapping it opens the keypad with the category already
  chosen, e.g. "⛽ Fuel".
- **Suggested automatically:** when the same payee/amount/category appears
  3 or more times in 30 days, show "Save as preset?" once.

### 2. Smart category chips

The 6 suggested chips are ranked by how often and how recently a category
was used, **at this time of day and day of week**. Coffee comes first at
8am and Lunch at 1pm. The details are in
[quick-log-implementation.md](quick-log-implementation.md). The chips reorder
between sessions, never while the user is looking at them.

### 3. Type it as one line (power users)

The note field doubles as a one-line parser:

```
3.4 coffee          → £3.40 · Coffee
lunch 12.50 @amex   → £12.50 · Lunch · Amex card
tesco 23.10         → £23.10 · Groceries (learned from payee history)
```

It matches words against preset names, category names and aliases, and
past payees. Anything it doesn't recognise becomes the note.

### 4. Undo, never "Are you sure?"

A save shows a toast: **"£3.40 Coffee logged · Undo"** for 5 seconds.
There are no confirmation dialogs. Mistakes are fixed by undoing or
editing, never by making every log slower.

### 5. Skip the category if you're in a rush

Typing an amount and pressing ↵ saves it **uncategorised**. It goes to a
**"To review"** inbox (a badge on the Finance tab), where the user can
categorise several items in a row later, for example in the evening. This
makes logging on the spot as fast as possible.

## Getting to the log screen

The fastest flow is useless if opening it takes 3 taps:

- **Floating ➕ button** on every screen, including the habits dashboard.
- **Keyboard shortcut `n`** on desktop.
- **Deep link** `/log?amount=3.40&category=coffee` works with phone home-screen
  shortcuts and iOS Shortcuts/Siri ("log coffee three forty"). This needs
  the router change mentioned in [frontend.md](frontend.md).
- **Installable PWA** with a manifest `shortcuts` entry, so "Log expense"
  appears when you long-press the app icon (Android and desktop Chrome).

## Evening catch-up mode

Many people log once a day from memory or receipts. After a save, catch-up
mode leaves the keypad open and shows today's entries underneath, so ten
expenses can be entered in a row without closing and reopening the log.

## What quick log doesn't do

- **No splits, tags or transfers.** Those are in the full transaction
  form (see [frontend.md](frontend.md)). If quick log gains fields, it
  stops being quick.
- **No bank sync.** [CSV import](recurring-and-import.md) and recurring
  rules remove bulk data entry. Quick log is for spending in the moment.

## Follow-ups (not v1)

- "Split with…": log £50 dinner as £25 mine + £25 owed by Sam (IOU).
- Receipt photo → OCR → amount/payee pre-filled.
- An evening reminder ("Log today's spending?"), once LifeOS has
  notifications. It could reuse the habits engine as a "Log expenses"
  habit, see [habits-integration.md](habits-integration.md).
