Daily Stock News Email Automation

Overview
- This adds a scheduled job that fetches recent news for a configurable list of tickers and emails a short summary to a recipient every morning.

How it works
- `data/portfolio.json` contains the config (tickers, recipient, delivery time & timezone). You can edit this file directly or use the Admin UI at `/admin/settings` which commits changes to the repo via the GitHub API.
- `scripts/daily-news.js` fetches news from NewsAPI (preferred) or Stooq (fallback - no key required). It supports a configurable **whitelist** (`newsDomains` or `newsSources`) and `excludeDomains` in `data/portfolio.json` to prioritize credible business sources, and uses `searchIn=title` with `sortBy=relevancy` and `pageSize=100` to reduce noise. The script builds a simple HTML summary and sends the email via SendGrid.
- `.github/workflows/daily-news.yml` runs every 15 minutes and calls the script; the script decides whether to send based on the configured delivery time/timezone. You can also trigger it manually from the Actions tab.
- You can preview the summary by visiting `/api/news/summary` when the app is running. If you don't have a `NEWS_API_KEY`, the preview will fall back to Stooq (no key needed).

Admin UI & GitHub commit method
- The Admin UI at `/admin/settings` allows you to edit the tickers, recipient email, delivery time and timezone from the browser. Submits are authenticated with an `ADMIN_API_KEY` and commit changes to `data/portfolio.json` using a `GITHUB_TOKEN` (PAT) stored in environment variables.

Required keys (set these as GitHub secrets for scheduled runs):
- `NEWS_API_KEY` — obtain at https://newsapi.org (preferred; set this if you added a NewsAPI key)
- `RESEND_API_KEY` — preferred mail provider; obtain at https://resend.com
- `SENDGRID_API_KEY` — optional (legacy support); obtain at https://sendgrid.com
- `SENDER_EMAIL` — optional; defaults to `no-reply@example.com` if not set
- `RECIPIENT_EMAIL` — optional; overrides `data/portfolio.json.recipientEmail`

Notes:
- If you do not provide `NEWS_API_KEY`, the scripts and preview endpoint will fall back to scraping Stooq.com for ticker-specific news (no API key required). Stooq provides public news pages and RSS feeds that we use as a low-cost fallback.

Editing portfolio and delivery time
- Edit `data/portfolio.json` in the repo. Example:
  {
    "tickers": ["NVDA","AAPL"],
    "recipientEmail": "you@example.com",
    "deliveryTime": "09:00",
    "timezone": "UTC"
  }
- For a non-technical UI to edit settings, we can add a simple settings page that commits changes to the repo using a GitHub token — say if you want this, I can implement it.

Notes & optional improvements
- Summaries are basic (headline + article summary). For richer, natural-language summaries you can add an LLM (OpenAI) step; I can add this optionally.
- If you prefer running at local timezone rather than UTC, the script now supports timezone-aware scheduling per `data/portfolio.json.timezone` and will only send at the configured `deliveryTime` in that timezone.

Caching behavior
- Once news is fetched it is cached at `data/news-cache.json` and will NOT be re-fetched until the next 08:00 in the configured timezone (this reduces API usage and stabilizes behavior).
- To force a refresh when testing, you can:
  - Set `FORCE_REFRESH=1` when running `scripts/daily-news.js` locally, or
  - Call the preview endpoint with `GET /api/news/summary?refresh=1` to force fetch.

How to test locally
1) Install deps: `npm ci` (this will install `luxon` which the scheduler uses)
2) Put your `NEWS_API_KEY` in your local env (e.g., `.env.local`) or provide it inline. Example (will print summary unless `SENDGRID_API_KEY` is provided):

```
NEWS_API_KEY=yourkey SENDGRID_API_KEY=yourkey RECIPIENT_EMAIL=you@domain.com node scripts/daily-news.js
```

By default the script will only send at the `deliveryTime` and `timezone` configured in `data/portfolio.json`. You can force send for testing using:

```
FORCE_SEND=1 NEWS_API_KEY=yourkey RECIPIENT_EMAIL=you@domain.com node scripts/daily-news.js
```

Notes on timezone
- Prefer IANA timezone names (e.g., `America/New_York`) for `timezone` in `data/portfolio.json`.
- The GitHub Actions workflow now runs every 15 minutes and the script decides when to actually send based on the configured delivery time and timezone.

(You can omit `SENDGRID_API_KEY` to print the email to stdout for review.)

Want me to wire a simple in-app settings page that updates `data/portfolio.json` via a GitHub commit (requires a GitHub PAT), or prefer to keep editing the JSON file manually? If you'd like, I can also add optional OpenAI-based summarization for cleaner bullet-point summaries.