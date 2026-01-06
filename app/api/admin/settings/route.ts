import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function readLocalConfig() {
  const cfgPath = path.join(process.cwd(), "data", "portfolio.json");
  if (!fs.existsSync(cfgPath)) return null;
  return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
}

async function getGitHubFileSha(owner: string, repo: string, filepath: string, token: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.sha ?? null;
}

async function putGitHubFile(owner: string, repo: string, filepath: string, contentStr: string, message: string, token: string, sha?: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`;
  const body: any = {
    message,
    content: Buffer.from(contentStr, "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function GET() {
  try {
    const cfg = readLocalConfig();
    return NextResponse.json({ config: cfg });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
    if (!ADMIN_API_KEY) return NextResponse.json({ error: "ADMIN_API_KEY not configured on server" }, { status: 500 });
    if (!adminKey || adminKey !== ADMIN_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    // Basic validation
    const tickers = Array.isArray(body.tickers) ? body.tickers.map((t: any) => String(t).toUpperCase().trim()) : null;
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : null;
    const deliveryTime = typeof body.deliveryTime === "string" ? body.deliveryTime.trim() : null;
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : null;

    if (!tickers || tickers.length === 0) return NextResponse.json({ error: "Tickers must be a non-empty array" }, { status: 400 });
    if (!recipientEmail) return NextResponse.json({ error: "recipientEmail is required" }, { status: 400 });

    const newCfg = {
      tickers,
      recipientEmail,
      deliveryTime: deliveryTime ?? "09:00",
      timezone: timezone ?? "UTC",
    };

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO; // owner/repo

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      // If not configured to write to GitHub, fallback to local file write (useful for local testing)
      const cfgPath = path.join(process.cwd(), "data", "portfolio.json");
      fs.writeFileSync(cfgPath, JSON.stringify(newCfg, null, 2), "utf8");
      return NextResponse.json({ ok: true, config: newCfg, note: "Saved locally (GITHUB_TOKEN or GITHUB_REPO not set)" });
    }

    const [owner, repo] = GITHUB_REPO.split("/");
    if (!owner || !repo) return NextResponse.json({ error: "GITHUB_REPO must be in owner/repo format" }, { status: 500 });

    const filepath = "data/portfolio.json";
    const sha = await getGitHubFileSha(owner, repo, filepath, GITHUB_TOKEN);
    const message = `Update portfolio.json via admin UI`;

    const result = await putGitHubFile(owner, repo, filepath, JSON.stringify(newCfg, null, 2), message, GITHUB_TOKEN, sha ?? undefined);

    return NextResponse.json({ ok: true, github: result.commit, config: newCfg });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
