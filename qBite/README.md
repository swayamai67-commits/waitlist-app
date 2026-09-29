# QBite — Restaurant Walk-in Waitlist

QBite is a local, browser-only waitlist for restaurant walk-ins. A host can add
parties, watch the live queue with estimated waits, call the next party, seat or
cancel them, and review the day's history. Everything is saved in the browser's
`localStorage`, so refreshing the page loses nothing.

Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, no backend.

## Running it

**Option A — just open the file.** Double-click `index.html` (or drag it into
Chrome, Edge, Firefox or Safari).

**Option B — serve the folder** (use this if your browser restricts `file://` pages):

```bash
cd qBite
python3 -m http.server 8000
# open http://localhost:8000
```

Data is stored per origin, so `file://…/index.html` and `http://localhost:8000`
each keep their own separate queue.

## Walkthrough

1. **Settings → Load demo data** fills today's queue with 10 fictional customers
   in every status. You can also start from an empty queue.
2. **Add customer** opens a form: name, phone, party size, table preference.
3. **Call next** calls the earliest waiting party. Each row also has its own
   **Call** button for calling a specific party, for example when a 2-top frees up.
4. A called party gets **Seat** (or **Cancel** for a no-show).
5. **History** lists seated and cancelled parties, with All / Seated / Cancelled
   filters and a day picker.
6. **Customer View** is the guest-facing screen. Enter a queue number (e.g. `7`
   or `#007`), or use the **Customer view** link on any waitlist row.

## Features

| Area | Behaviour |
| --- | --- |
| Dashboard | Waiting / Called / Seated / Total today, computed from stored data on every render. Shows the next party, a big **Call next** button, called parties ready to seat, and a queue preview. |
| Waitlist | Called and Waiting sections. Each entry shows queue number, name, phone, party size, table preference, join time, time waiting, estimated wait, place in line, status and actions. |
| Queue numbers | `#001`, `#002`, … increment per restaurant day. Numbers are never reused within a day, including after cancellations. They restart at `#001` on a new day. |
| Statuses | `WAITING → CALLED`, `WAITING → CANCELLED`, `CALLED → SEATED`, `CALLED → CANCELLED`. All other transitions are rejected in the data layer. |
| Cancel | Always asks for confirmation. The customer stays in History. |
| History | Seated and cancelled parties with joined, called and seated times. Filters: All, Seated, Cancelled. The last 30 days are kept. |
| Customer view | A simpler guest screen that reads the same stored data: queue number, name, party, place in line, estimated wait and status. It updates on refresh, every 30 seconds, and immediately when another tab changes the data. |
| Settings | Restaurant name, average table turnover (used for estimates), Load demo data, Clear data. |

## Estimated wait

```
estimated wait = (waiting parties ahead) × (average table turnover, default 10 min)
```

This is a deliberately simple, deterministic rule of thumb, not a prediction. It
is recalculated whenever the queue changes. All of the logic lives in
`estimateWaitMinutes()` in `data.js`, so a smarter model can replace it without
touching the UI.

## Validation and error handling

- **Name:** required, 2–60 characters, must contain letters.
- **Phone:** required, 10–15 digits. Spaces, dashes, brackets and a leading `+`
  are allowed. A phone number already active in today's queue is rejected, with
  the queue number it already holds.
- **Party size:** a whole number from 1 to 20.
- **Table preference:** must be able to seat the party (for example, a party of
  6 cannot pick a 2-seater).
- **Call next with nobody waiting** shows "No customers are currently waiting."
- **Invalid or duplicate actions** are rejected with a message and the screen
  refreshes. This covers double clicks, a stale tab, and seating or cancelling a
  customer who has already been seated or cancelled. Every action re-reads
  storage before it validates.
- **Corrupted storage:** unreadable JSON is backed up to
  `qbite.backup.corrupt`, and the app starts clean and tells the user. Individual
  damaged records are skipped and the rest are kept. The queue counter is
  repaired so numbers are never duplicated.
- **Blocked storage** (some private windows): the app still works in memory and
  shows a banner saying data won't persist.

## New restaurant day

The current day is stored with the data as a local `YYYY-MM-DD` key, built from
the browser's local clock. It never uses UTC `toISOString()`, which would cause
timezone bugs. When the date changes, on load or while the app is open (checked
every 30 seconds and whenever the tab becomes visible):

- a new, empty active queue starts and numbering restarts at `#001`
- parties from the previous day who were never seated are closed as `CANCELLED`
  (marked "Closed at end of day") so they drop out of the active queue
- the previous days' records stay available under **History → Day**

The day boundary is local midnight.

## Project structure

```
qBite/
├── index.html   Markup for all views and dialogs
├── style.css    Styles and responsive layout (desktop sidebar → mobile bottom tab bar)
├── data.js      The only code that touches localStorage: load/validate/repair, day rollover,
│                queue rules, status transitions, estimates, demo data
├── script.js    UI: hash routing, rendering, forms, dialogs, toasts
└── README.md
```

### Data layer (`data.js`)

The whole app state sits under one `localStorage` key, `qbite.state.v1`:

```js
{
  version: 1,
  day: { date: "2026-09-29", lastQueueNumber: 7 },
  settings: { restaurantName: "QBite Restaurant", turnoverMinutes: 10 },
  customers: [{
    id, queueNumber, serviceDate, customerName, phone, partySize,
    tablePreference, joinedAt, calledAt, seatedAt, cancelledAt, status, autoClosed
  }]
}
```

Timestamps are epoch milliseconds, and IDs come from `crypto.randomUUID()`
(with a fallback). The UI uses only the `QBiteData` API: `getQueue()`,
`getStats()`, `getHistory()`, `getSnapshot()`, `addCustomer()`,
`updateCustomer()`, `callNext()`, `callCustomer()`, `seatCustomer()`,
`cancelCustomer()`, `saveSettings()`, `loadDemoData()` and `clearData()`.
Each write follows the same steps: read the latest state, validate, persist,
then the UI re-renders.

## Known limitations (by design for this local MVP)

- **Single browser only.** The customer view reads this browser's storage, so it
  suits a second tab or a host-stand tablet. It does not reach a guest's own
  phone. That needs a backend.
- No SMS or WhatsApp notifications, no accounts, no table map.
- The day boundary is fixed at local midnight. A restaurant open past midnight
  would see its queue roll over at 12:00 AM.
