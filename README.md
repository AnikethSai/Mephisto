# Mephisto's Bargain — Soul Coin System

A specialized, high-integrity digital Soul Coin management system built for the live college fest game **"Mephisto's Bargain"**.

Designed specifically for real-time live-event operation where speed, reliability, simplicity, and accounting precision are paramount.

---

## 🏛️ System Architecture & Interfaces

The system features two isolated interfaces with strict backend authorization:

```
                            ┌───────────────────────────────────────────────┐
                            │               MEPHISTO'S BARGAIN               │
                            │           Soul Coin Management System         │
                            └───────────────────────┬───────────────────────┘
                                                    │
                   ┌────────────────────────────────┴───────────────────────────────┐
                   ▼                                                                ▼
       ┌───────────────────────┐                                        ┌───────────────────────┐
       │ PARTICIPANT INTERFACE │                                        │  ORGANIZER INTERFACE  │
       │     (Mobile-First)    │                                        │    (Command Center)   │
       └───────────┬───────────┘                                        └───────────┬───────────┘
                   │                                                                │
  • Authenticates via private QR URL & PIN                         • Protected by Master Password
  • Exposes ONLY authenticated team data                           • Full access to all 27 teams
  • Displays live Soul Coin balance                                • Live balances & manual +/- controls
  • Atomic peer-to-peer transfers                                  • Assigns & edits round metadata badges
  • Private transaction history                                    • Real-time ledger audit log
  • Real-time SSE updates & 4s polling sync                        • Credentials & QR distribution hub
```

> **Important**: There is **no public interface** and **no public leaderboard**. Team balances and transaction histories are strictly confidential to each team and game organizers.

---

## ⚙️ Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** | Full-stack React framework with server routes, streaming, and fast local deployment. |
| **Language** | **TypeScript** | Strict compile-time typing for financial calculations, auth payloads, and API contracts. |
| **Styling** | **Tailwind CSS** | Custom infernal dark theme (`#080608` obsidian, ember gold, crimson accents). |
| **Database** | **SQLite via `better-sqlite3`** | Embedded ACID SQL database running in WAL mode with synchronous atomic transactions. No external database server required. |
| **Authentication** | **JOSE (JWT) + BCrypt** | HTTP-only, secure session cookies. Team PINs and organizer passwords are cryptographically hashed. |
| **Real-time Sync** | **Server-Sent Events (SSE)** | Native HTTP streaming (`/api/events`) with heartbeat and 4-second polling fallback for fluctuating campus Wi-Fi. |
| **QR Code Engine** | **node-qrcode** | Dynamic QR code generation for physical credentials distribution. |

---

## 📂 Project Directory Structure

```
SoulCoinSystem/
├── data/
│   ├── soulcoins.db             # Local SQLite database (WAL mode)
│   └── team_credentials.json   # Exported team cards (Number, Name, Access URL, PIN)
├── scripts/
│   ├── init-db.cjs              # Schema executor
│   ├── seed.cjs                 # Seeds 27 teams & organizer credentials
│   └── test-integrity.cjs       # Double-entry ledger & atomic transfer test suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── organizer/login/route.ts
│   │   │   │   ├── organizer/logout/route.ts
│   │   │   │   ├── team/login/route.ts
│   │   │   │   └── team/logout/route.ts
│   │   │   ├── organizer/
│   │   │   │   ├── adjust/route.ts          # Manual +/- balance adjustment
│   │   │   │   ├── teams/route.ts           # Fetch all teams and balances
│   │   │   │   ├── transactions/route.ts    # Fetch all ledger entries
│   │   │   │   └── transactions/[id]/route.ts # Edit transaction badge/note
│   │   │   ├── participant/
│   │   │   │   ├── me/route.ts              # Fetch current team only
│   │   │   │   ├── transactions/route.ts    # Fetch current team ledger only
│   │   │   │   └── transfer/route.ts        # Atomic team-to-team transfer
│   │   │   └── events/route.ts              # Server-Sent Events stream
│   │   ├── organizer/
│   │   │   ├── login/page.tsx               # Organizer login screen
│   │   │   └── page.tsx                     # Organizer Command Dashboard
│   │   ├── participant/
│   │   │   └── page.tsx                     # Mobile participant dashboard
│   │   ├── t/[accessKey]/page.tsx           # Gateway for scanned QR codes & PIN entry
│   │   ├── globals.css                      # Infernal theme styling & glow effects
│   │   ├── layout.tsx                       # Root layout
│   │   └── page.tsx                         # Private event portal landing
│   ├── components/
│   │   ├── organizer/
│   │   │   ├── AdjustmentModal.tsx          # Fast +/- coin grant/revoke modal
│   │   │   ├── EditBadgeModal.tsx           # Metadata badge editor (never alters balance)
│   │   │   └── TeamQrModal.tsx              # QR & PIN card viewer
│   │   └── participant/
│   │       ├── BalanceCard.tsx              # Team balance card
│   │       ├── TeamAuthForm.tsx             # PIN keypad authentication
│   │       ├── TransactionList.tsx          # Participant ledger entries
│   │       └── TransferModal.tsx            # Atomic transfer modal with review step
│   └── lib/
│       ├── auth.ts                          # JWT creation, verification, cookie helpers
│       ├── db.ts                            # Database connection & ACID transaction methods
│       ├── events.ts                        # In-memory EventBus for real-time broadcasts
│       ├── schema.sql                       # SQLite schema definition
│       └── types.ts                         # Core TypeScript interfaces
├── .env.example
├── .env.local
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 🔒 Security & Data Isolation Model

1. **No Guessable Team URLs**:
   Teams do not access pages via sequential IDs like `/team/07`. Instead, each team is assigned a cryptographically random 128-bit hex `access_key` (e.g. `/t/863725109a3df6668a403412d47374b7`).
2. **Two-Factor Access**:
   Accessing the private URL prompts the participant for their team's private 4-digit PIN.
3. **Backend Authorization Guards**:
   Upon PIN verification, a secure `HTTP-Only` cookie (`mb_participant_session`) is signed with the team's identity. All participant API routes query exclusively by `session.teamId`. Other teams' balances are **never sent to the client**.
4. **Organizer Authentication**:
   The organizer portal is protected by a master password with an independent `HTTP-Only` cookie (`mb_organizer_session`).
5. **Atomic Peer-to-Peer Transfers**:
   Team transfers execute in a single synchronous SQLite transaction:
   - Validates `sender.balance >= transfer_amount`
   - Validates `amount > 0`
   - Validates `sender.id != recipient.id`
   - Deducts from sender and credits recipient atomically
   - Inserts audit transaction record

---

## 🏷️ Round Badges

Transactions support organizational badges:
- `Round 1`
- `Round 2`
- `Round 3`
- `Round 4`
- `The Pact`
- `Round 5`
- `Round 6`
- `General / Adjustment` (or custom strings)

> **Core Principle**: Badges are display metadata only. They do **not** trigger game logic or alter balances. Organizers can freely correct a transaction's badge or note without impacting any team's coin balance.

---

## 🚀 Running the Project

### Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 9+

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
The project includes a pre-configured `.env.local`:
```env
DATABASE_PATH=./data/soulcoins.db
JWT_SECRET=mephisto_bargain_super_secret_dev_key_2026_fest
ORGANIZER_PASSWORD=mephisto2026
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Initialize & Seed Database
Seeds 27 teams and creates the default organizer account (`mephisto` / `mephisto2026`):
```bash
npm run db:seed
```
*Generated credentials and QR access URLs are exported to `data/team_credentials.json`.*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Organizer Portal**: [http://localhost:3000/organizer/login](http://localhost:3000/organizer/login)
  - Password: `mephisto2026`
- **Team Access**:
  - Open any URL from `data/team_credentials.json` (e.g. `http://localhost:3000/t/<accessKey>`)
  - Enter the team's 4-digit PIN

### 5. Production Build
```bash
npm run build
npm run start
```

### 6. Verify Accounting & Integrity
Run the built-in test suite:
```bash
node scripts/test-integrity.cjs
```
