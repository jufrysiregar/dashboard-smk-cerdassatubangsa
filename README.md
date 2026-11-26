# SekolahKU — School Management System · Standalone Frontend Demo

> A **100% client-side, portfolio-ready demo** of a multi-role Indonesian vocational-high-school (SMK) management platform. Every feature runs in the browser using a **`localStorage` mock engine** — no Laravel, no MySQL, no network required.

This repository is a **standalone, self-contained copy** of the production frontend. The original full-stack project is completely untouched. Clone it, `npm install`, `npm run dev`, and click straight into any role's dashboard.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [How the Mock Engine Works](#how-the-mock-engine-works)
- [Demo Accounts & Quick Access](#demo-accounts--quick-access-credentials)
- [Development Timeline & AI-Assisted Workflow](#development-timeline--ai-assisted-engineering-workflow)
- [Local Setup](#local-setup--running-the-demo)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Notes & Limitations](#notes--limitations)

---

## Project Overview

**SekolahKU** is an integrated school-management web application for **SMK Cerdas Satu Bangsa**, consolidating academic, administrative, financial, and executive workflows into a single React SPA. It supports **9+ distinct roles** — from Super Admin and academic operators to teachers, students, cashiers, the principal, vice principals, department leads, and internship/honorary staff — each with a purpose-built dashboard.

This **demo build** reproduces the entire UI and core business logic against an in-browser mock backend, so it can be reviewed, tested, and showcased without provisioning a server or database.

---

## Key Features

- **Multi-Role RBAC (9+ roles).** Single codebase, role-routed dashboards with granular menus and permissions: `operator` (Super Admin), `admin_akademik`, `guru`, `murid`, `cashier`, `kepala_sekolah`, `wakil_sekolah`, `pusat_jurusan`, plus `magang` / `honorer` special-staff workspaces.
- **CBT Exam Engine with Anti-Cheat & Token System.** Token-gated entry, live countdown, per-question navigation, autosave, tab-switch detection with tolerance/lock, idle detection, and automatic scoring with a full answer review (`benar / kunci / jawaban_siswa`).
- **Teacher Essay Module.** A **custom Canvas PDF viewer** (`pdfjs-dist`) with zoom and multi-page layout, a **Rich Text Editor** (Quill) for answers, photo/file submission, and confirmation flow — all driven by a bundled local exam sheet (`/demo-soal-esai.pdf`).
- **Teacher Task & Question-Bank Management.** Create/edit/delete assignments and question packages (multiple-choice & essay), a live submission **monitor**, and one-click grading with score + feedback that persists instantly.
- **Cashier / Finance Management.** SPP billing generation, point-of-sale payment, payment-verification approvals, petty cash, general cash book (BKU), arrears tracking, and recharts-powered cash-flow dashboards.
- **Executive & Academic Analytics.** Population, KBM/journal completeness, grade trends, teacher presence, financial rollups, facility condition, and vice-principal class-plotting views — all populated with realistic, interconnected sample data.
- **Self-Service Password Reset.** A 3-step OTP flow (verify ID → send OTP → set new password), fully functional against the mock store.
- **1-Click Role Login & Reset Demo Data.** Fast portfolio walkthrough: jump into any role instantly, and restore the pristine dataset at any time.

---

## Tech Stack & Architecture

### Frontend (this demo)
| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.2 |
| Build tool / dev server | Vite | 5.0 |
| Routing | React Router DOM | 6.30 |
| Styling | Tailwind CSS | 3.3 |
| HTTP client | Axios | 1.14 |
| Charts | Recharts | 3.8 |
| Animation | Framer Motion | 12.38 |
| PDF rendering | pdfjs-dist (Canvas viewer) | 6.5 |
| DOCX parsing | Mammoth.js | 1.13 |
| PDF export | jsPDF + jspdf-autotable | 4.2 / 5.0 |
| Rich text editor | react-quill | 2.0 |
| Spreadsheets | SheetJS (xlsx) | 0.18 |
| Dates | date-fns + react-day-picker | 4.1 / 8.10 |
| Icons | lucide-react | 0.294 |
| Notifications | react-hot-toast | 2.6 |

### Original Full-Stack Architecture (production)
The demo mirrors a **Laravel + React** application:

- **Backend:** PHP 8.1, **Laravel 10**, **Laravel Sanctum 3.3** (token auth), Guzzle 7 (HTTP), PhpSpreadsheet 5.6 (Excel import/export), PHPUnit 10 (tests).
- **Database:** MySQL.
- **Frontend:** the React SPA above, talking to the Laravel REST API via Axios.

> **In this repository the backend is replaced by a client-side mock engine.** The Axios layer, response envelopes, and endpoint contracts are identical to the production API, so the UI behaves exactly as it does against Laravel — it just reads/writes `localStorage` instead.

---

## How the Mock Engine Works

```
src/
├── mocks/
│   ├── db.js            # localStorage persistence helpers (namespaced "demo:")
│   ├── demoSeeder.js    # builds the full interconnected dataset + resetDemoData()
│   ├── handlers.js      # endpoint router: maps method+path -> localStorage CRUD
│   └── installMock.js   # custom Axios adapter + window.fetch shim + auto-seed
├── services/api.js      # re-export shim (exposes resetDemoData())
└── utils/api.js         # the real Axios instance — mock adapter installed here
```

- **Auto-seed on first load.** `installMock()` seeds `localStorage` the first time the app runs (versioned, so schema changes re-seed cleanly).
- **Axios adapter.** Every request through the shared Axios instance is intercepted by `mockAdapter` and answered from `localStorage`. `GET` returns seeded/computed collections; `POST`/`PUT`/`PATCH`/`DELETE` mutate the store so the UI reflects changes immediately.
- **`fetch` shim.** A handful of endpoints (notifications, sleep/cleaning status, special-staff work) use raw `fetch('/api/...')`; these are transparently intercepted too.
- **Graceful fallback.** Endpoints outside the priority demo modules return safe, non-crashing placeholder payloads.
- **Reset.** The in-app **"Reset Data Demo"** button (sidebar) wipes the store and restores the original dataset.

---

## Demo Accounts & Quick Access Credentials

> Source of truth: `Tutorial dan Data User.md` from the original project.

| Role | Username / ID | Password |
|---|---|---|
| **Super Admin** (Master Operator) | `superadmin@164990` | `Super!138.` |
| **Admin Akademik / Operator** | `randyasha@000058` | `Super!140.` |
| **Guru** | `budisantoso@000040` | `Budi123_` |
| **Murid** (Student) | `agussari@0028` | `Agussari123_` |
| **Kasir** (Cashier) | `ahmadjkk@000055` | `Adhmad123_` |
| **Kepala Sekolah** (Principal) | `muhtadinn@000053` | `Muhtadin123_` |
| **Wakil Kepala Sekolah** (Vice Principal) | `elinaph@000054` | `Elina123_` |
| **Pusat Jurusan** (Department Lead) | `hendrasanjaya@000059` | `Hendra123_` |
| **Magang** (Intern) | `farhanlaburehia@000065` | `Farhan123_` |
| **Honorer** (Honorary Staff) | `bagussetiawan@000063` | `Bagus123_` |
| **Guru / Staff** | `putriwidya@000064` | `PutriW12_` |

**Try these ready-made demo scenarios:**
- **Student → CBT exam:** enter token **`CBT123`** (10 multiple-choice questions, auto-scored).
- **Student → Essay task:** open the essay assignment — the **Canvas PDF viewer** loads the bundled `/demo-soal-esai.pdf`; answer with the rich-text editor and submit.
- **Student → Teacher quiz:** token **`WEBKUIS`** (5-question CBT with leaderboard & trophy tiers).
- **Password reset (self-service):** use any ID above; the OTP is fixed for the demo → **`123456`**.

**Convenience features**
- **1-Click Role Login** — a grid of role cards on the login screen signs you straight into each dashboard.
- **Self-Service Password Reset** — full 3-step OTP flow, working entirely client-side.
- **Reset Demo Data** — restore the pristine dataset anytime from the dashboard sidebar.

---

## Development Timeline & AI-Assisted Engineering Workflow

This project has been under continuous development **since May 2025**. It was built through a structured, **AI-assisted engineering and QA workflow**, pairing human architecture and review with iterative assistance from multiple models throughout design, implementation, refactoring, and verification:

- **Antigravity**
- **Gemini AI**
- **DeepSeek**
- **Codex (ChatGPT)**
- **QwenWork**

The workflow emphasized spec-first planning, parallel code exploration, field-level API-contract mapping, and automated verification (the demo's mock router is covered by a headless logic suite validating login, RBAC routing, exam scoring, and finance mutations).

---

## Local Setup — Running the Demo

```bash
# 1. Install dependencies
#    (--legacy-peer-deps resolves a react-day-picker / date-fns peer range conflict)
npm install --legacy-peer-deps

# 2. Start the dev server (http://localhost:3000)
npm run dev

# 3. Production build (outputs to dist/)
npm run build

# 4. Preview the production build locally
npm run preview
```

Requirements: **Node.js 18+** (developed on Node 24). No database or backend is required.

---

## Deployment

The demo is a static SPA and deploys to any static host:

- **Vercel / Netlify:** framework = Vite, build = `npm run build`, output = `dist`.
- **GitHub Pages:** build `dist/` and publish; set Vite `base` to your repo path if it is not served from the domain root.

Because everything is client-side, no environment variables or API targets are needed in production.

---

## Project Structure

```
sekolah-management-demo/
├── public/
│   └── demo-soal-esai.pdf     # bundled essay exam sheet for the Canvas PDF viewer
├── src/
│   ├── mocks/                 # localStorage demo engine (see above)
│   ├── pages/                 # 87 route/page components across all roles
│   ├── components/            # shared UI, exam runner, PDF viewer, auth steps
│   ├── utils/                 # api.js (mock-wired Axios), helpers
│   └── services/              # api.js re-export shim
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Notes & Limitations

- **Demo scope.** Priority modules (login/RBAC, CBT exam, essay PDF + grading, question bank & tasks, cashier/finance, executive & academic dashboards, department & internship views, special-staff workspace) are fully interactive against `localStorage`. Secondary pages render with safe placeholder data so the app never hard-crashes.
- **Persistence is per-browser.** All data lives in `localStorage` on the reviewer's machine. Use **Reset Data Demo** to return to the seeded state.
- **Security is illustrative.** Passwords are stored in plain text in `localStorage` purely for the demo; this is **not** a production security model.

---

*Built as a standalone, self-contained demo — the original Laravel + MySQL project remains untouched.*
