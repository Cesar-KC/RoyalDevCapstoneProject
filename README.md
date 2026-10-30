# RoyalDev Capstone – Budget App

A full-stack personal budgeting application built as a senior capstone project at UMKC (Commerce Bank Personal Finance & Budgeting Assistant).

**Current status (midterm):** users can register, log in, create a monthly budget with a plan and category allocations, record income and expenses, and compare their plan with actual spending on the budget page and dashboard.

## Features

- **Accounts and sessions:** register, log in, and log out. Sessions use a secure cookie and expire after 12 hours (NIST 800-63B AAL2).
- **Monthly budget:** set an expected budget for the month, choose a plan (Balanced 50/30/20, Save more 40/20/40, Essentials 60/20/20), and split needs and wants across categories. Warnings show when the plan goes over a target, but never block saving.
- **Transactions:** record income and expenses with amount, category, date, and optional notes, and browse them by month.
- **Plan vs. actual:** the budget page shows spending per category, income received, and projected savings for the month.
- **Dashboard:** a summary of the current month's budget and the 5 most recent transactions.

## Tech Stack

| Layer    | Technology                                                   |
|----------|--------------------------------------------------------------|
| Frontend | React (Vite), JavaScript, React Router, Tailwind CSS v4      |
| Backend  | Python, FastAPI, SQLAlchemy, Pydantic, bcrypt                |
| Database | MySQL                                                        |

Tested with Python 3.13, Node.js 24, and MySQL 9.6.

## Project Structure

```
RoyalDevCapstoneProject/
├── back-end/              FastAPI application
│   ├── main.py            App setup, CORS, and all API routes
│   ├── database.py        Database connection (engine, sessions, UTC)
│   ├── models.py          SQLAlchemy models (database tables)
│   ├── schemas.py         Pydantic schemas (API request/response shapes and validation)
│   ├── security.py        Session token creation, hashing, and expiry
│   ├── requirements.txt
│   └── .env.example       Template for local database settings
├── front-end/             React application (Vite)
│   ├── vite.config.js     Tailwind plugin and the /api proxy to the backend
│   └── src/
│       ├── main.jsx            Entry point
│       ├── App.jsx             Routes
│       ├── index.css           Tailwind import
│       ├── LoginPage.jsx
│       ├── RegisterPage.jsx
│       ├── DashboardPage.jsx   Monthly summary and recent transactions
│       ├── BudgetPage.jsx      Create a budget, or view plan vs. actual
│       ├── TransactionsPage.jsx Add and browse income and expenses
│       └── budgetMath.js       Shared budget calculations
├── database/
│   └── schema.sql         Creates the database, all tables, and seed categories
└── docs/                  Project documents (charter, requirements, use cases, schema)
```

## Setup

### 1. Database

Run `database/schema.sql` as an admin user (e.g., root) in MySQL Workbench. It creates the `db_budget_app` database, six tables (`users`, `sessions`, `categories`, `budgets`, `budget_allocations`, `transactions`), and seeds 14 categories.

> **Development only:** the script drops and recreates every table, so all existing data is lost each time it runs.

Then create a restricted user for the app (replace the password):

```sql
CREATE USER 'budget_app_user'@'localhost' IDENTIFIED BY 'your-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON db_budget_app.* TO 'budget_app_user'@'localhost';
```

### 2. Backend

```bash
cd back-end
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `DB_PASSWORD` to the password from step 1. Never commit `.env`.

### 3. Frontend

```bash
cd front-end
npm install
```

After pulling changes that add packages (for example Tailwind), run `npm install` again and restart the dev server.

## Running the App

Use two terminals:

| Terminal | Commands | URL |
|----------|----------|-----|
| Backend  | `cd back-end` → `source .venv/bin/activate` → `fastapi dev main.py` | http://127.0.0.1:8000 |
| Frontend | `cd front-end` → `npm run dev` | http://localhost:5173 |

Open the app at **http://localhost:5173**. The Vite dev server forwards every `/api` request to the backend, so the browser sees one address and the session cookie works.

Interactive API docs (Swagger) are available at http://127.0.0.1:8000/docs. To call protected endpoints there, run `POST /api/login` on that page first.

## API Endpoints

All endpoints except register and login require a valid session cookie; otherwise they return `401`.

| Method | Path | Description | Responses |
|--------|------|-------------|-----------|
| POST | `/api/register` | Create a new user | 201 Created, 409 Duplicate, 422 Invalid input |
| POST | `/api/login` | Log in and start a session (sets the cookie) | 200 OK, 401 Invalid credentials, 422 Invalid input |
| GET | `/api/me` | Get the logged-in user | 200 OK, 401 |
| POST | `/api/logout` | End the session and clear the cookie | 204 No Content |
| GET | `/api/categories` | List all categories | 200 OK, 401 |
| GET | `/api/budgets?month=YYYY-MM` | Get the budget for a month, with allocations | 200 OK, 401, 404 No budget, 422 |
| POST | `/api/budgets` | Create the budget for a month, with allocations | 201 Created, 401, 409 Already exists, 422 |
| GET | `/api/transactions?month=YYYY-MM` | List a month's transactions, newest first | 200 OK, 401, 422 |
| GET | `/api/transactions/recent?limit=N` | Newest transactions across all months (limit 1–20, default 3) | 200 OK, 401, 422 |
| POST | `/api/transactions` | Record an income or expense | 201 Created, 401, 422 |

## How It Works

- **Sessions:** login creates a random token, stores only its SHA-256 hash in `sessions`, and sends the raw token in an HttpOnly cookie. Each protected request hashes the cookie and looks it up. Logout revokes the session.
- **Who owns the data:** the user is always taken from the session, never from the request, so users can only see and change their own data.
- **Budgets:** one budget per user per month. The plan's percentages are decided by the server from the plan name. Every need and want category gets an allocation row ($0 if left empty).
- **Calculations:** targets, savings, and plan vs. actual numbers are calculated in `budgetMath.js` from stored data. Nothing calculated is stored in the database.
- **Time:** all timestamps are stored in UTC; the current month and transaction dates follow the user's local calendar.

## Git Workflow

1. Start from an up-to-date `main`: `git switch main` → `git pull`
2. Create a branch per feature: `git switch -c feature/<name>`
3. Commit and push your work to the branch
4. Open a pull request into `main` and merge after testing

## Roadmap

- [x] User registration and login
- [x] Sessions (secure cookie, 12 hour-expiry (NIST 800-63B AAL2), logout)
- [x] Monthly budget creation with plans and category allocations
- [x] Income and expense transactions
- [x] Plan vs. actual on the budget page and dashboard
- [x] Styling with Tailwind (matching the Figma designs)
- [ ] AI budgeting assistant
- [ ] Data visualization (charts)
- [ ] Session inactivity timeout (30 minutes of inactivity logs the user out)
- [ ] Profile and settings
- [ ] Notifications
- [ ] Deployment
