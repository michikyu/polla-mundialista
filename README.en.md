# ⚽ World Cup Prediction Pool (Polla Mundialística)

[Español](README.md) · **English**

Web app to run a **World Cup prediction pool** with friends. Everyone predicts the scores, points are
calculated automatically, and there's a live standings table, group stage and knockout bracket.
Mobile-first, **the UI is in Spanish**, and it's **100% free to host**.

> Built for the **2026 World Cup** (all 72 group-stage matches are preloaded with date, Colombian
> kickoff time and stadium). Easy to adapt to any tournament.

<p align="center">
  <img src="docs/screenshots/inicio.png" width="24%" alt="Home" />
  <img src="docs/screenshots/tabla.png" width="24%" alt="Standings" />
  <img src="docs/screenshots/mundial.png" width="24%" alt="Group stage" />
  <img src="docs/screenshots/reglas.png" width="24%" alt="Rules" />
</p>

## ✨ Features

- 📝 **Per-person predictions**, each with its own password. Submitted **once** and **secret** until
  the match kicks off (you only see who has already predicted).
- 🔒 **Automatic lock** of each match at kickoff (anchored to Colombian time, UTC-5).
- 🏆 **Automatic standings** with a points system and ties broken by earliest submission.
- 🌎 **Group stage** (12 groups), best third-placed teams and a **knockout bracket that fills itself in**.
- 🔄 **Automatic results** from [football-data.org](https://www.football-data.org) (optional).
- 🔔 **Telegram group alerts** before each match and when it ends (optional).
- 📱 Mobile-first design; looks great on iPhone and Android.
- 🆓 Runs free on **Vercel + Turso** (no credit card) or locally with SQLite.

## 🏆 Scoring

| Outcome | Points |
|---|---|
| Exact score and you were the **only** one to get it | **5** |
| Exact score, but **shared** (others got it too) | **4** |
| Right winner or draw (not the exact score) | **3** |
| Missed | **0** |

On a points tie, whoever **submitted their prediction earliest** ranks higher. The admin can **change
these values** from **⚙️ Settings** (recalculates the table retroactively). Once a match kicks off,
**nobody —not even the admin— can modify** a participant's prediction.

## 🚀 Deploy your own for free (Vercel + Turso)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmichikyu%2Fpolla-mundialista&env=ADMIN_PASSWORD,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN&envDescription=Admin%20password%20and%20your%20Turso%20database%20credentials)

No credit card required.

1. **Fork** this repo to your GitHub account.
2. **Create the database** on [Turso](https://turso.tech) (free plan): create a database and copy its
   **Database URL** and an **Auth Token**.
3. **Import the repo into [Vercel](https://vercel.com)** (New Project → your fork). Framework: *Vite*.
4. **Set the environment variables** in Vercel (Settings → Environment Variables):

   | Variable | Required? | What for |
   |---|---|---|
   | `ADMIN_PASSWORD` | ✅ Yes | Admin password (register results, edit everything) |
   | `TURSO_DATABASE_URL` | ✅ Yes | Your Turso database URL |
   | `TURSO_AUTH_TOKEN` | ✅ Yes | Your Turso auth token |
   | `FOOTBALL_DATA_TOKEN` | ⚪ Optional | Automatic results ([free token](https://www.football-data.org/client/register)) |
   | `TELEGRAM_BOT_TOKEN` | ⚪ Optional | Telegram alerts (create a bot with [@BotFather](https://t.me/BotFather)) |
   | `TELEGRAM_CHAT_ID` | ⚪ Optional | Telegram group ID (a negative number) |
   | `CRON_SECRET` | ⚪ Recommended | Protects the notifications cron (Vercel sends it automatically) |
   | `VITE_APP_TITLE` | ⚪ Optional | App title (defaults to "Polla Mundialística"). Can also be changed live from **⚙️ Settings** in admin mode. |

5. **Deploy.** Done: your pool lives at `https://your-project.vercel.app`.
6. **Customize the participants:** open the app, tap **🔒 Admin** (at the bottom) with your
   `ADMIN_PASSWORD`, go to **Tabla** (Standings) and add/edit your friends with their personal password.

> 💡 The 4 example participants (`Ana`, `Bruno`, `Carla`, `Diego`) and their passwords live in
> [`server/fixtures.ts`](server/fixtures.ts); change them there before the first run, or from the
> **Tabla** tab in admin mode.

## 💻 Run locally (optional)

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. With no environment variables it uses a local SQLite database at
`data/polla.db` and the default admin password is `changeme` (override it with `ADMIN_PASSWORD`).

Other commands:

```bash
npm run build      # build the frontend + bundle the API
npm run db:reset   # wipe and reseed ONLY the local database
npm run typecheck  # type-check
```

## 🔔 Telegram alerts (optional)

A Vercel cron (`vercel.json`) calls `/api/notify` every 10 minutes during the tournament. On each run
it **syncs results** and posts to the group:

1. A **pre-match alert** 45 min before each match, listing who hasn't predicted.
2. A **result alert** when it ends, with the score and the updated standings.

<p align="center">
  <img src="docs/screenshots/telegram.png" width="60%" alt="Example of the Telegram alerts" />
</p>

To enable it: create a bot with [@BotFather](https://t.me/BotFather), add it to your group, get the
`chat_id` (send `/start@YourBot` in the group and check
`https://api.telegram.org/bot<TOKEN>/getUpdates`) and set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.
The bot only reads commands (`/…`), not normal messages. The **group invite link** (for the
quick-access button) is pasted from **⚙️ Settings** in the app, in admin mode.

> football-data.org's free plan is sometimes **delayed** in publishing results; you can always enter
> them by hand from each match's **⋮** menu.

## 🛠️ Stack

- **Frontend:** React 19 + Vite 7 + TypeScript
- **Backend:** Express 5 (serverless on Vercel) + TypeScript
- **Database:** SQLite via [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts)
  (local file or [Turso](https://turso.tech) in the cloud)
- **No UI frameworks** or heavy dependencies; flags via [flagcdn.com](https://flagcdn.com).

## 📂 Structure

```
├── api/             Serverless entry point for Vercel
├── server/          API (Express), database, sync and notifications
│   ├── fixtures.ts  2026 World Cup schedule + example participants
│   ├── routes/      Endpoints: participants, matches, predictions, standings, sync, notify
│   └── notifier.ts  Telegram alerts (pre-match + result)
├── shared/          Shared types, scoring rules, teams and bracket
├── src/             React frontend (views and components)
└── docs/screenshots README images
```

## 📄 License

[MIT](LICENSE). Use it, modify it and share it freely.
