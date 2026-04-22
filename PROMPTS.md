# PROMPTS.md — AI Prompts Used

This file documents the prompts used when building `cf_ai_code_reviewer` with AI assistance (Claude Sonnet).

---

## Prompt 1 — Project Architecture

**Prompt:**
> I need to build an AI-powered application on Cloudflare for a job application. Requirements: LLM (Llama 3.3 on Workers AI), Workflow/coordination (Durable Objects or Workflows), User input via chat, Memory or state. I want to build a Code Review & Debugging Bot. I have less than 1 day. Design the full architecture mapping each requirement to a Cloudflare product and explain how they connect.

**Used for:** Deciding the overall architecture — Worker as API router, Durable Object for per-session state, Workers AI for LLM, Pages for the React UI.

---

## Prompt 2 — Durable Object Implementation

**Prompt:**
> Generate a Cloudflare Durable Object class called `CodeReviewSession` in TypeScript that:
> - Stores conversation history as `{ role, content }[]` in durable storage
> - Tracks review count and session creation time as metadata
> - Rehydrates state from storage on construction using `blockConcurrencyWhile`
> - Exposes three routes: POST /chat (calls Workers AI), GET /history, POST /reset
> - Calls `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with a structured code review system prompt
> - Keeps last 10 turns for context window management

**Used for:** `worker/src/index.ts` — the `CodeReviewSession` class and its fetch handler.

---

## Prompt 3 — Worker Router

**Prompt:**
> Write the main Cloudflare Worker export default that:
> - Adds CORS headers to all responses
> - Handles OPTIONS preflight
> - Parses URL pattern `/api/<sessionId>/<action>`
> - Routes requests to the correct Durable Object using `idFromName(sessionId)`
> - Forwards the request to the DO and returns its response with CORS headers

**Used for:** The `export default` block in `worker/src/index.ts`.

---

## Prompt 4 — React UI Component

**Prompt:**
> Build a React component for a code review chat application with:
> - Left panel with two tabs: "Code Editor" (textarea for pasting code) and "Chat" (follow-up questions)
> - Right panel showing conversation history with markdown rendering and syntax highlighting
> - Session management using UUID stored in sessionStorage
> - Calls to /api/<sessionId>/chat with either { message, code } or just { message }
> - Loading states, typing indicator, review count badge
> - Reset session button that calls /api/<sessionId>/reset
> Use react-markdown and react-syntax-highlighter with vscDarkPlus theme.

**Used for:** `frontend/src/App.tsx`

---

## Prompt 5 — Terminal Aesthetic CSS

**Prompt:**
> Design CSS for a dark terminal/code-editor aesthetic UI with:
> - JetBrains Mono for code/body, Syne for display headings
> - Color palette: near-black background (#0a0c0f), cyan accent (#00d4ff), dimmed text
> - Scanline overlay effect using CSS repeating-linear-gradient
> - macOS-style traffic light dots on the editor bar
> - Animated typing indicator (bouncing dots)
> - Glowing review button with cyan gradient
> - Message bubbles with left border accent for AI responses
> - Scrollbar styling, fade-up message animation
> Avoid generic purple gradients and Inter/Roboto fonts.

**Used for:** `frontend/src/App.css`

---

## Prompt 6 — wrangler.toml Configuration

**Prompt:**
> Write a wrangler.toml for a Cloudflare Worker named `cf-ai-code-reviewer` that:
> - Binds Workers AI as `AI`
> - Declares a Durable Object binding `CODE_REVIEW_SESSION` pointing to class `CodeReviewSession`
> - Includes the required migrations block for the new Durable Object class
> - Sets compatibility_date to 2024-09-23 and enables nodejs_compat

**Used for:** `worker/wrangler.toml`

---

## Prompt 7 — README

**Prompt:**
> Write a comprehensive README.md for a Cloudflare AI application called cf_ai_code_reviewer that:
> - Shows ASCII architecture diagram mapping each component
> - Has a table mapping the 4 assignment requirements to the implementation
> - Explains local dev setup (wrangler --remote for Workers AI access)
> - Covers production deployment for both Worker and Pages
> - Documents the API endpoints
> - Lists key features

**Used for:** `README.md`

---

## System Prompt Used in the Application

The following system prompt is injected into every Workers AI call:

```
You are an expert code reviewer and debugger with deep knowledge of security vulnerabilities, 
performance patterns, and clean code principles.

When reviewing code:
1. Start with a brief summary of what the code does
2. List issues by severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 💡 Suggestion
3. For each issue: explain the problem, why it matters, and provide a fixed code snippet
4. End with an overall score (1-10) and 3 key takeaways

For follow-up questions, reference the code already shared in this session.
Be direct, specific, and educational. Format using markdown.
```
