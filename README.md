# Riverdale Academy — School Finance Manager

A full-stack finance management system for Riverdale Academy, Kumasi, Ghana. Tracks fee income, expenses, loans, recurring obligations, capital projects, and policy documents with strict role-based access control and separation of duties.

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
  → CloudFront (https://*.cloudfront.net)
       /api/*  → API Gateway HTTP API → Lambda (ARM64, Docker)
                                            ↕ Secrets Manager
                                            ↕ RDS PostgreSQL (VPC)
                                            ↕ S3 (document uploads)
       /*       → S3 (React SPA static assets)
```

## Modules

| Module | Description |
|---|---|
| Fee Receipts | Record and approve school fee payments by student/grade |
| Expenses | Log and approve operational expenditure |
| Loans | Track school loans — disbursements, repayments, approval workflow |
| Students | Student registry with grade, status, and parent contact |
| Obligations | Recurring payments (insurance, taxes, contracts, utilities) |
| Projects | Capital projects with multi-source funding tracker |
| Documents | Policy documents and official files (text or file upload) |
| Audit Trail | Immutable log of all create/update/approve actions |
| Settings | Currencies, expense categories, fee categories |
| Users | User management and role assignment |

## Roles

| Role | Permissions |
|---|---|
| SUPER_ADMIN | User management; read-only financials |
| CASHIER | Enter fee receipts; cannot approve anything |
| FINANCE_MANAGER | Approve receipts/expenses (not own); manage loans; create obligations/projects/docs |
| PRINCIPAL | Approve (not own); full read-only |
| AUDITOR | Full read-only + audit trail |

Separation of duties is enforced server-side: the user who created a transaction cannot approve it.

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
cp .env.example .env
# Edit .env — DATABASE_URL is pre-configured for Docker Compose

# 4. Push schema and seed
cd server
npm run db:push
npm run db:seed

# 5. Start development servers
# Terminal 1:
cd server && npm run dev    # http://localhost:4000

# Terminal 2:
cd client && npm run dev    # http://localhost:5173
```

Or on Windows, double-click **`start.bat`** to start everything automatically.

### Default accounts

| Email | Password | Role |
|---|---|---|
| admin@school.edu | Admin@1234 | SUPER_ADMIN |
| finance@school.edu | Finance@1234 | FINANCE_MANAGER |
| cashier@school.edu | Cashier@1234 | CASHIER |
| principal@school.edu | Principal@1234 | PRINCIPAL |
| auditor@school.edu | Auditor@1234 | AUDITOR |

## AWS Deployment

### Prerequisites
- AWS CLI configured (`aws configure`)
- Docker Desktop running (to build the Lambda image)
- Node.js 20+
- AWS CDK: `npm install -g aws-cdk`

### Deploy

```powershell
# From the project root:
.\deploy.ps1
```

The script will:
1. Bootstrap CDK in your AWS account (safe to run multiple times)
2. Build the React frontend
3. Build the Docker image for Lambda (ARM64)
4. Deploy the CloudFormation stack (~10-15 minutes)
5. Push the Prisma schema to RDS via Lambda invocation
6. Print the CloudFront URL

### Infrastructure (CDK — `infra/`)

| Resource | Details |
|---|---|
| VPC | 2 AZs, public + private (NAT) + isolated subnets |
| RDS | PostgreSQL 16, t4g.micro, isolated subnet, encrypted |
| Lambda | ARM64 Docker image, 512 MB, 30s timeout |
| API Gateway | HTTP API, routes `/api/*` to Lambda |
| CloudFront | Routes `/api/*` → API Gateway, `/*` → S3 frontend |
| S3 (uploads) | `schoolfinance-uploads-<account>` — document files |
| S3 (frontend) | `schoolfinance-frontend-<account>` — React SPA |
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

> The NAT Gateway is the main cost. It allows Lambda to call Secrets Manager and other AWS APIs from inside the VPC. Cost can be reduced by switching to NAT Instance (~$8/month for t3.micro) after initial setup.

### Re-deploying after code changes

```powershell
# Frontend-only change (fast):
cd client && npm run build
cd infra && cdk deploy --require-approval never

# Backend change (rebuilds Docker image):
.\deploy.ps1
```

### Running DB schema changes after deploy

```powershell
# Invoke the Lambda's built-in db push handler:
aws lambda invoke `
  --function-name SchoolFinanceApi `
  --payload '{"action":"dbpush"}' `
  response.json
cat response.json
```

## Project structure

```
school-finance/
├── client/                     # React 18 + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── layout/         # AppLayout, sidebar navigation
│       │   └── shared/         # DataTable, PageHeader, FormField, ...
│       ├── lib/
│       │   ├── api.ts          # Typed API client (Axios)
│       │   └── utils.ts
│       ├── pages/              # One directory per module
│       ├── store/              # Zustand auth store
│       └── types/              # Shared TypeScript types
├── server/                     # Express + Prisma backend
│   └── src/
│       ├── controllers/        # Request handlers
│       ├── middleware/         # auth, RBAC, validation
│       ├── routes/             # Express routers
│       ├── services/           # prisma, audit, s3, sequences
│       ├── types/              # AuthRequest, express augmentation
│       ├── app.ts              # Express app (shared by server and Lambda)
│       ├── index.ts            # Local development server entry
│       └── lambda.ts           # AWS Lambda handler
├── prisma/
│   └── schema.prisma           # Prisma schema (PostgreSQL)
├── infra/                      # AWS CDK TypeScript project
│   ├── bin/app.ts
│   └── lib/school-finance-stack.ts
├── Dockerfile.lambda           # Multi-stage ARM64 Lambda image
├── .dockerignore
├── deploy.ps1                  # One-shot deployment script
├── docker-compose.yml          # Local PostgreSQL + pgAdmin
└── start.bat                   # Windows one-click startup
```

## Tech stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS v3, React Query, React Hook Form, Zod, Recharts, Lucide Icons

**Backend:** Node.js 20, Express 4, TypeScript, Prisma ORM v5, PostgreSQL, JWT, Zod, Multer, Helmet, Morgan

**AWS:** Lambda (ARM64 Docker), API Gateway HTTP API, RDS PostgreSQL 16, S3, CloudFront, Secrets Manager, VPC, CDK v2
