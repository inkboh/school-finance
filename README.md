# Riverdale Academy — School Finance Manager

A full-stack finance management system for Riverdale Academy, Kumasi, Ghana. Tracks fee income, expenses, loans, recurring obligations, capital projects, and policy documents with strict role-based access control and separation of duties.

**Production:** https://adwuma.riverdalekumasi.com

---

## Architecture

### Local development
```
client/ (React 18 + Vite + TypeScript + Tailwind)
    |
    | Vite proxy /api → http://localhost:4000
    |
server/ (Express + TypeScript + Prisma)
    |
    | DATABASE_URL
    |
PostgreSQL (Docker Compose)
```

### AWS production
```
Browser
  → CloudFront (adwuma.riverdalekumasi.com)
       /api/*  → API Gateway HTTP API → Lambda (ARM64, Docker)
                                            | Secrets Manager (DB creds, JWT)
                                            | RDS PostgreSQL 16 (VPC isolated)
                                            | S3 (document uploads)
       /*       → S3 (React SPA static assets)
```

---

## Modules

| Module | Description |
|---|---|
| Fee Receipts | Record and approve school fee payments by student/grade |
| Fee Tracker | Monthly matrix showing paid/unpaid status per student across the school year |
| Expenses | Log and approve operational expenditure |
| Loans | Track school loans — disbursements, repayments, approval workflow |
| Students | Student registry with grade, status, and parent contact |
| Obligations | Recurring payments (insurance, taxes, contracts, utilities) with director voting |
| Projects | Capital projects with multi-source funding tracker and director voting |
| Documents | Policy documents and official files (text or file upload) with director voting |
| Audit Trail | Immutable log of all create/update/approve/vote actions |
| Settings | Currencies, exchange rates, expense categories, fee categories |
| Users | User management and role assignment |

---

## Roles

| Role | Permissions |
|---|---|
| SUPER_ADMIN | User management; read-only financials; settings |
| CASHIER | Enter fee receipts; cannot approve anything |
| FINANCE_MANAGER | Approve receipts/expenses (not own); manage loans; create obligations/projects/docs |
| PRINCIPAL | Approve expenses (not own); full read-only |
| AUDITOR | Full read-only + audit trail |
| DIRECTOR | Co-proprietors; read-only financials; vote FOR/AGAINST/ABSTAIN on projects, obligations, and documents |

Separation of duties is enforced server-side: the user who created a transaction cannot approve it.

### Director voting

Directors can cast named votes (FOR / AGAINST / ABSTAIN) on Projects, Obligations, and Documents. Each vote is recorded with the director's name and is visible to all users. A director can retract and re-cast their vote at any time. The vote tally and full voter record appear on each item's detail page.

---

## Local Development

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)

### Setup

```bash
# 1. Start database
docker compose up -d

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Configure environment
cp server/.env.example server/.env
# DATABASE_URL is pre-configured for Docker Compose

# 4. Push schema and seed
cd server
npm run db:push
npm run db:seed

# 5. Start development servers (two terminals)
cd server && npm run dev    # http://localhost:4000
cd client && npm run dev    # http://localhost:5173
```

Or on Windows, run **`.\start.ps1`** from the project root to start everything automatically.

### Default local accounts

| Email | Password | Role |
|---|---|---|
| admin@school.edu | Admin@1234 | SUPER_ADMIN |
| finance@school.edu | Finance@1234 | FINANCE_MANAGER |
| cashier@school.edu | Cashier@1234 | CASHIER |
| principal@school.edu | Principal@1234 | PRINCIPAL |
| auditor@school.edu | Auditor@1234 | AUDITOR |
| director@school.edu | Director@1234 | DIRECTOR |

---

## AWS Deployment

### Prerequisites
- AWS CLI configured (`aws configure`) pointing at account `705285596598`
- Docker Desktop running (to build the Lambda image)
- Node.js 20+
- AWS CDK: `npm install -g aws-cdk`

### Deploy

Run from the project root:

```powershell
# Normal deploy — build + CDK + schema push
.\deploy.ps1

# First deploy, or after adding new users
.\deploy.ps1 -Setup
```

**`.\deploy.ps1`** (every code change):
1. Checks prerequisites (AWS CLI, Docker, Node, CDK)
2. Installs dependencies in all three packages
3. Builds the React frontend
4. Bootstraps CDK (safe to re-run)
5. Deploys the CloudFormation stack (builds Docker image, ~10-15 min first run)
6. Invokes the Lambda `dbpush` action to apply any schema changes
7. Prints the app URL

**`.\deploy.ps1 -Setup`** (first deploy or when users are added):
All of the above, plus:
- `seed` — inserts currencies, fee/expense categories, and user records
- `import` — loads student data from the spreadsheet export
- `importHistorical` — loads historical fee receipts and expenses
- `cognitoBootstrap` — creates all DB users in Cognito (temp password: `School.Finance2025!`)

All Lambda actions are idempotent — safe to re-run; existing records are skipped.

### Lambda admin actions

The Lambda function accepts direct invocation for admin tasks. The `deploy.ps1` script handles these automatically, but they can be triggered manually if needed:

| Payload | Effect |
|---|---|
| `{"action":"dbpush"}` | Apply Prisma schema to RDS (run after every schema change) |
| `{"action":"seed"}` | Seed currencies, categories, and users |
| `{"action":"import"}` | Import student roster from spreadsheet data |
| `{"action":"importHistorical"}` | Import historical fee receipts and expenses |
| `{"action":"cognitoBootstrap"}` | Create/update all users in Cognito user pool |

### Infrastructure (CDK — `infra/`)

| Resource | Details |
|---|---|
| VPC | 2 AZs, public + private (NAT) + isolated subnets |
| RDS | PostgreSQL 16, t4g.micro, isolated subnet, encrypted, 7-day backup |
| Lambda | ARM64 Docker image, 512 MB, 30s timeout |
| API Gateway | HTTP API, routes `/api/*` to Lambda |
| CloudFront | Custom domain `adwuma.riverdalekumasi.com`; `/api/*` → API Gateway; `/*` → S3 |
| ACM | Wildcard cert `*.riverdalekumasi.com` (us-east-1) pinned to CloudFront |
| S3 (uploads) | `schoolfinance-uploads-<account>` — document file attachments |
| S3 (frontend) | `schoolfinance-frontend-<account>` — React SPA |
| Cognito | User pool with `custom:role` attribute; self-signup disabled |
| Secrets Manager | DB credentials, JWT secret, refresh secret |

### Estimated AWS cost (us-east-1)

| Service | Est. monthly |
|---|---|
| RDS t4g.micro | ~$13 |
| NAT Gateway | ~$32 |
| Lambda + API Gateway | ~$1 (low traffic) |
| S3 + CloudFront | ~$2 |
| Secrets Manager (3) | ~$1 |
| **Total** | **~$49/month** |

> The NAT Gateway dominates cost. It allows Lambda to reach Secrets Manager from inside the VPC. Can be replaced with a NAT Instance (~$8/month t3.micro) after initial setup to reduce cost.

---

## Project structure

```
school-finance/
├── client/                     # React 18 + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── layout/         # AppLayout, AppSidebar, ProtectedRoute
│       │   └── shared/         # DataTable, PageHeader, FormField,
│       │                       # StatusBadge, VotePanel, ...
│       ├── lib/
│       │   ├── api.ts          # Typed API client (Axios + auto token refresh)
│       │   ├── cognito.ts      # Cognito auth helpers
│       │   └── utils.ts        # formatCurrency, formatDate, getRoleLabel, ...
│       ├── pages/              # One directory per module
│       ├── store/              # Zustand auth store
│       └── types/              # Shared TypeScript types (Role, VoteType, ...)
├── server/                     # Express + Prisma backend
│   └── src/
│       ├── controllers/        # Request handlers (one file per module)
│       │   └── votes.controller.ts   # Director vote cast/read/retract
│       ├── handlers/           # Lambda-only action handlers
│       │   ├── import-data.handler.ts
│       │   └── import-historical.handler.ts
│       ├── middleware/         # authenticate, requireRole, validate
│       ├── routes/             # Express routers
│       │   └── votes.routes.ts
│       ├── services/           # prisma, audit, s3, sequences
│       ├── app.ts              # Express app (shared by dev server and Lambda)
│       ├── index.ts            # Local development server entry
│       └── lambda.ts           # AWS Lambda handler + admin action dispatch
├── prisma/
│   ├── schema.prisma           # Prisma schema (Role, VoteType, DirectorVote, ...)
│   └── historical-data.json    # Historical fee receipts and expenses for import
├── infra/                      # AWS CDK TypeScript project
│   ├── bin/app.ts
│   └── lib/school-finance-stack.ts
├── Dockerfile.lambda           # Multi-stage ARM64 Lambda image
├── .dockerignore
├── deploy.ps1                  # One-command deployment script
├── docker-compose.yml          # Local PostgreSQL + pgAdmin
└── start.ps1                   # Windows one-click local startup
```

---

## Tech stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS v3, React Query v5, React Hook Form, Zod, Recharts, Lucide Icons, date-fns

**Backend:** Node.js 20, Express 4, TypeScript, Prisma ORM v5, PostgreSQL 16, Zod, JWT, Multer, Helmet, Morgan, bcryptjs

**AWS:** Lambda (ARM64 Docker), API Gateway HTTP API, RDS PostgreSQL 16, S3, CloudFront, Cognito, Secrets Manager, VPC, CDK v2, Serverless HTTP
