# RoyalDev Capstone – Budget App

A full-stack budgeting application built as a senior capstone project at UMKC.

**Current status:** User registration and login works end to end (React form → FastAPI → MySQL).

## Tech Stack

| Layer    | Technology                                   |
|----------|----------------------------------------------|
| Frontend | React (Vite), JavaScript, Tailwind CSS       |
| Backend  | Python, FastAPI, SQLAlchemy, Pydantic, bcrypt|
| Database | MySQL                                        |

Tested with Python 3.13, Node.js 24, and MySQL 9.6.

## Setup

### 1. Database

Run `database/schema.sql` as an admin user (e.g., root) in MySQL Workbench. This creates the `db_budget_app` database and the `users` table.

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

## Running the App

Use two terminals:

| Terminal | Commands | URL |
|----------|----------|-----|
| Backend  | `cd back-end` → `source .venv/bin/activate` → `fastapi dev main.py` | http://127.0.0.1:8000 |
| Frontend | `cd front-end` → `npm run dev` | http://localhost:5173 |

Interactive API docs are available at http://127.0.0.1:8000/docs.

## API Endpoints

| Method | Path            | Description         | Responses                          |
|--------|-----------------|---------------------|------------------------------------|
| POST   | `/api/register` | Create a new user   | 201 Created, 409 Duplicate, 422 Invalid input |
| POST   | `/api/login`    | Login valid user    | 200 Created, 401 Invalid           |

## Git Workflow

1. Start from an up-to-date `main`: `git switch main` → `git pull`
2. Create a branch per feature: `git switch -c feature/<name>`
3. Commit and push your work to the branch
4. Open a pull request into `main` and merge after testing

## Roadmap

- [x] User registration
- [X] Login
- [ ] sessions
- [ ] Styling with Tailwind (match Figma designs)
- [ ] Transactions, categories, budgets, and payment methods
