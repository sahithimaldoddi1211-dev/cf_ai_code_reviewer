# cf_ai_code_reviewer

> **AI-powered code review and debugging assistant** built on Cloudflare's developer platform.

Paste any code snippet and get a structured review covering security vulnerabilities, bugs, performance issues, and best-practice suggestions — then ask follow-up questions in a persistent chat session.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Platform                   │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────────┐ │
│  │  Cloudflare      │    │  Durable Object:           │ │
│  │  Pages           │───▶│  CodeReviewSession         │ │
│  │  (React UI)      │    │  • Per-session memory      │ │
│  └──────────────────┘    │  • Conversation history    │ │
│                          │  • Review count state      │ │
│  ┌──────────────────┐    └──────────┬─────────────────┘ │
│  │  Cloudflare      │               │                   │
│  │  Worker          │◀──────────────┘                   │
│  │  (API Router)    │                                   │
│  └──────────┬───────┘                                   │
│             │                                           │
│  ┌──────────▼───────┐                                   │
│  │  Workers AI      │                                   │
│  │  Llama 3.3 70B   │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

### Components mapped to requirements

| Requirement | Implementation |
|---|---|
| **LLM** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI binding |
| **Workflow / Coordination** | Durable Objects — each browser session gets its own `CodeReviewSession` DO instance |
| **User Input** | React chat UI (Cloudflare Pages) with code editor + follow-up chat |
| **Memory / State** | Durable Object storage persists conversation history and review metadata across requests |

---

## Project Structure

```
cf_ai_code_reviewer/
├── worker/                  # Cloudflare Worker + Durable Object
│   ├── src/index.ts         # Main worker + CodeReviewSession DO
│   ├── wrangler.toml        # Worker config (AI binding, DO binding)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React + Vite UI
│   ├── src/
│   │   ├── App.tsx          # Main UI component
│   │   ├── App.css          # Terminal-aesthetic styling
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── .env.example
├── README.md
└── PROMPTS.md
```

---

Deployed through Netlify - https://codereviewer-sm.netlify.app/

## Running Locally

### Prerequisites
- Node.js 18+
- A Cloudflare account ([dash.cloudflare.com](https://dash.cloudflare.com))
- Wrangler CLI authenticated: `npx wrangler login`

### 1. Deploy the Worker (required even for local UI dev)

Workers AI and Durable Objects require a Cloudflare account — they don't run 100% offline. Wrangler's `--remote` flag lets you run the worker locally while it calls real Cloudflare services.

```bash
cd worker
npm install
npm run dev -- --remote
# Worker starts at http://localhost:8787
```

> **Note:** `--remote` is needed because Workers AI models are only available on Cloudflare's infrastructure.

### 2. Run the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
# UI starts at http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8787`, so no CORS issues.

Open `http://localhost:5173` in your browser.

---

## Deploying to Production

### 1. Deploy the Worker

```bash
cd worker
npm run deploy
# Outputs: https://cf-ai-code-reviewer.<your-subdomain>.workers.dev
```

### 2. Deploy the Frontend to Cloudflare Pages

```bash
cd frontend

# Set the worker URL
echo "VITE_WORKER_URL=https://cf-ai-code-reviewer.<your-subdomain>.workers.dev" > .env.local

npm run build

# Deploy via Wrangler Pages
npx wrangler pages deploy dist --project-name cf-ai-code-reviewer-ui
```

Or connect the repo to Cloudflare Pages in the dashboard for automatic deployments on push.

---

## How It Works

1. **Session initialization** — on first load, the browser generates a UUID (stored in `sessionStorage`) which maps to a unique Durable Object instance.

2. **Code review** — user pastes code and clicks "Review Code". The Worker routes the request to the correct DO instance, which calls Workers AI with a structured system prompt and appends the result to persistent storage.

3. **Follow-up chat** — subsequent messages are sent with the full conversation history (last 10 turns) so the AI has context about the specific code reviewed.

4. **State persistence** — the Durable Object stores `history` and `meta` (review count, creation time) in its key-value storage, surviving Worker restarts.

5. **Session reset** — "New Session" clears DO storage and generates a new UUID, starting fresh.

---

## API Reference

All endpoints: `POST/GET https://<worker-url>/api/<sessionId>/<action>`

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/:id/chat` | `{ message, code? }` | Send message / submit code for review |
| `GET` | `/api/:id/history` | — | Retrieve full conversation history |
| `POST` | `/api/:id/reset` | — | Clear session state |

---

## Features

- 🔍 **Structured code review** — severity-tiered feedback (Critical → Suggestion)
- 💬 **Persistent chat** — ask follow-ups without re-pasting code
- 🧠 **Session memory** — Durable Objects maintain state across requests  
- 🌓 **Terminal aesthetic UI** — dark, editor-style interface with syntax highlighting
- ⚡ **Edge-native** — runs entirely on Cloudflare's global network
- 🔒 **Session isolation** — each user gets their own Durable Object instance
