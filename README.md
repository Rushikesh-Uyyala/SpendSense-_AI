# SpendSense AI — Personal Finance Management Platform

SpendSense AI is a full-stack personal finance management platform combining real-time income and expense tracking, monthly budget threshold alerts, smart savings goals, statistical cashflow forecasting, recurring schedules, and an AI financial assistant grounded strictly in your persisted database records.

## Live Workspace Architecture

- **Frontend**: React + TypeScript + Tailwind CSS v4 + Chart.js + Lucide Icons (`src/`)
- **Backend**: Express REST API (`server.ts` + `src/server/`)
- **Authentication**: Scrypt password hashing, HMAC-SHA256 signed HTTP-only session cookies, password reset workflow, and strict per-user data isolation
- **AI Engine**: Server-side Gemini API (`@google/genai` using `gemini-4-hydrogen`) for grounded personalized insights, multi-turn Q&A, and monthly financial reports
- **Database Schema**: Normalized 12-table PostgreSQL / Supabase DDL provided in `database/schema.sql`, paired with atomic server-side persistence in `.data/spendsense-db.json` when running standalone without an external database instance

## Quick Start

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the full-stack development server on port 3000:
   ```bash
   npm run dev
   ```
4. Build and run in production:
   ```bash
   npm run build
   npm start
   ```

## Demo Account

Click **Explore Live Demo** on the landing page or **Sign in with Demo Account** in the login modal (`demo@spendsense.ai` / `Demo@1234`) to inspect multi-month INR records, budgets, goals, and forecasts, or register a brand-new private account.

## Supabase / PostgreSQL Migration Reference

The complete normalized 12-table schema (`users`, `profiles`, `user_settings`, `categories`, `transactions`, `budgets`, `savings_goals`, `savings_contributions`, `recurring_transactions`, `notifications`, `ai_recommendations`, `financial_reports`) with Row-Level Security (RLS) policies and indexes is located in `database/schema.sql`.
