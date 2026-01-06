// scripts/daily-news.js
// Run: NEWS_API_KEY=... SENDGRID_API_KEY=... node scripts/daily-news.js (falls back to Stooq if NEWS_API_KEY is not set)

const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');
const { DateTime } = require('luxon');

async function fetchNewsApiArticles(ticker, from, to, apiKey, opts = {}) {
  // Build a tighter query focused on headlines and business-relevant keywords to reduce noise
  const q = `${ticker} AND (earnings OR revenue OR guidance OR acquisition OR merger OR SEC OR analyst OR stock OR price)`;
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('from', from);
  params.set('to', to);
  params.set('searchIn', 'title');
  params.set('sortBy', 'relevancy');
  params.set('pageSize', '100');
  params.set('language', 'en');
  if (Array.isArray(opts.domains) && opts.domains.length) params.set('domains', opts.domains.join(','));
  if (Array.isArray(opts.sources) && opts.sources.length) params.set('sources', opts.sources.join(','));
  if (Array.isArray(opts.excludeDomains) && opts.excludeDomains.length) params.set('excludeDomains', opts.excludeDomains.join(','));
  params.set('apiKey', apiKey);
  const url = `https://newsapi.org/v2/everything?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  return res.json();
} 

async function fetchStooqNews(ticker, from, to) {
  const url = `https://stooq.com/n/?s=${encodeURIComponent(ticker)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Stooq ${res.status}: ${await res.text()}`);
  const text = await res.text();
  const re = /<a[^>]+href="(\/n\/\?f=[^\"]+)"[^>]*>([^<]+)<\/a>/gi;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({ href: m[1], title: m[2].trim() });
  }
  return matches;
}

function pickTopArticlesFromNewsApi(resp, n = 3) {
  const articles = Array.isArray(resp?.articles) ? resp.articles : [];
  return articles.slice(0, n).map(a => ({
    headline: a.title || a.description || a.source?.name || 'No title',
    summary: a.description || '',
    url: a.url || null,
    datetime: a.publishedAt || null,
    source: a.source?.name || null,
  }));
}

function pickTopArticlesFromStooq(entries, n = 3) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, n).map(e => ({
    headline: e.title || 'No title',
    summary: '',
    url: e.href ? `https://stooq.com${e.href}` : null,
    datetime: null,
    source: null,
  }));
}

function htmlForSummary(summaryByTicker, asOf) {
  const lines = [];
  lines.push(`<h1>Daily Market News — ${asOf}</h1>`);
  lines.push(`<p>Automatic summary of recent headlines for your tracked tickers.</p>`);
  for (const [ticker, articles] of Object.entries(summaryByTicker)) {
    lines.push(`<h2 style="margin-top:1rem">${ticker}</h2>`);
    if (!articles.length) {
      lines.push(`<p>No recent articles found.</p>`);
    } else {
      lines.push('<ul>');
      for (const art of articles) {
        const title = art.headline;
        const summary = art.summary ? `<div style="color:#444;font-size:0.95rem">${art.summary}</div>` : '';
        const url = art.url ? `<a href="${art.url}">${art.url}</a>` : '';
        lines.push(`<li style="margin-bottom:0.5rem"><strong>${title}</strong>${summary}<div style="font-size:0.85rem;color:#666">${url}</div></li>`);
      }
      lines.push('</ul>');
    }
  }
  lines.push('<hr /><p style="font-size:0.85rem;color:#666">This summary was generated automatically.</p>');
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.4">${lines.join('\n')}</body></html>`;
}

async function sendEmailWithResend(to, subject, html, resendKey, from) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from,
      to: [{ email: to }],
      subject,
      html
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return true;
}

// Backwards-compatible SendGrid support in case you still have a key
async function sendEmailWithSendGrid(to, subject, html, sendgridKey, from) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid ${res.status}: ${text}`);
  }
  return true;
}

async function readNewsCache() {
  const CACHE_PATH = path.join(process.cwd(), 'data', 'news-cache.json');
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function writeNewsCache(obj) {
  const CACHE_PATH = path.join(process.cwd(), 'data', 'news-cache.json');
  fs.writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

function next8amAfter(dt) {
  let candidate = dt.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
  if (candidate <= dt) candidate = candidate.plus({ days: 1 });
  return candidate;
}

async function main() {
  try {
    const cfgPath = path.join(process.cwd(), 'data', 'portfolio.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

    const NEWS_API_KEY = process.env.NEWS_API_KEY; // if not present we fall back to Stooq (no key required)
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const RECIPIENT_OVERRIDE = process.env.RECIPIENT_EMAIL;
    const SENDER = process.env.SENDER_EMAIL || 'no-reply@example.com';

    const tickers = Array.isArray(cfg.tickers) ? cfg.tickers : [];
    if (!tickers.length) throw new Error('No tickers configured in data/portfolio.json');

    const recipient = RECIPIENT_OVERRIDE || cfg.recipientEmail;
    if (!recipient) throw new Error('No recipient email set (set RECIPIENT_EMAIL or data/portfolio.json.recipientEmail)');

    const to = new Date();
    const toStr = to.toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 2);
    const fromStr = fromDate.toISOString().slice(0, 10);

    // Scheduling: check delivery time & timezone in config unless FORCE_SEND=1
    const FORCE_SEND = !!process.env.FORCE_SEND;
    const FORCE_REFRESH = !!process.env.FORCE_REFRESH;
    const deliveryTime = cfg.deliveryTime || '09:00';
    const timezone = cfg.timezone || 'UTC';

    // Parse HH:MM
    const [hourStr, minStr] = (deliveryTime || '09:00').split(':');
    const targetHour = Number(hourStr || 9);
    const targetMinute = Number(minStr || 0);

    let nowInZone = DateTime.now().setZone(timezone);
    if (!nowInZone.isValid) {
      console.warn(`Invalid timezone '${timezone}', defaulting to UTC`);
      nowInZone = DateTime.now().setZone('UTC');
    }

    console.log(`Now in ${timezone}: ${nowInZone.toFormat('yyyy-LL-dd HH:mm')}`);

    if (!FORCE_SEND) {
      if (!(nowInZone.hour === targetHour && nowInZone.minute === targetMinute)) {
        console.log(`Not delivery time yet (target ${deliveryTime} ${timezone}). Exiting.`);
        return;
      }
    }

    // Check cache
    const cache = await readNewsCache();
    if (cache && cache.expiresAt && !FORCE_REFRESH) {
      const expires = DateTime.fromISO(cache.expiresAt).setZone(timezone);
      if (expires > nowInZone && cache.summary) {
        console.log(`Using cached news (expires ${cache.expiresAt}).`);
        const html = htmlForSummary(cache.summary, cache.asOf || new Date().toLocaleString());
        const subject = `Daily Stock News — ${new Date().toLocaleDateString()}`;

        const RESEND_API_KEY = process.env.RESEND_API_KEY;

        if (!RESEND_API_KEY && !SENDGRID_API_KEY) {
          console.log('No mail provider key set — printing email to stdout for review:');
          console.log('Subject:', subject);
          console.log(html);
          return;
        }

        if (RESEND_API_KEY) {
          await sendEmailWithResend(recipient, subject, html, RESEND_API_KEY, SENDER);
          console.log('Email sent via Resend to', recipient);
        } else {
          await sendEmailWithSendGrid(recipient, subject, html, SENDGRID_API_KEY, SENDER);
          console.log('Email sent via SendGrid to', recipient);
        }

        return;
      }
    }

    console.log(`Fetching news for ${tickers.length} tickers from ${fromStr} to ${toStr}`);

    const summaryByTicker = {};
    for (const t of tickers) {
      try {
        if (NEWS_API_KEY) {
          const resp = await fetchNewsApiArticles(t, fromStr, toStr, NEWS_API_KEY, {
            domains: Array.isArray(cfg.newsDomains) ? cfg.newsDomains : [],
            sources: Array.isArray(cfg.newsSources) ? cfg.newsSources : [],
            excludeDomains: Array.isArray(cfg.excludeDomains) ? cfg.excludeDomains : [],
          });
          summaryByTicker[t] = pickTopArticlesFromNewsApi(resp, 3);
        } else {
          const entries = await fetchStooqNews(t, fromStr, toStr);
          summaryByTicker[t] = pickTopArticlesFromStooq(entries, 3);
        }
      } catch (e) {
        console.error(`Error fetching ${t}:`, e?.message || e);
        summaryByTicker[t] = [];
      }
    }

    // write cache with next 8am expiry in the configured timezone
    const now = DateTime.now().setZone(timezone);
    const next8 = next8amAfter(now);
    const cacheObj = {
      asOf: new Date().toISOString(),
      fetchedAt: now.toISO(),
      expiresAt: next8.toISO(),
      summary: summaryByTicker,
    };

    await writeNewsCache(cacheObj);
    console.log('Wrote cache, expires at', cacheObj.expiresAt);

    const html = htmlForSummary(summaryByTicker, cacheObj.asOf);
    const subject = `Daily Stock News — ${new Date().toLocaleDateString()}`;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY && !SENDGRID_API_KEY) {
      console.log('No mail provider key set — printing email to stdout for review:');
      console.log('Subject:', subject);
      console.log(html);
      return;
    }

    if (RESEND_API_KEY) {
      await sendEmailWithResend(recipient, subject, html, RESEND_API_KEY, SENDER);
      console.log('Email sent via Resend to', recipient);
    } else {
      await sendEmailWithSendGrid(recipient, subject, html, SENDGRID_API_KEY, SENDER);
      console.log('Email sent via SendGrid to', recipient);
    }
  } catch (err) {
    console.error('Failed to run daily-news:', err?.message || err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
