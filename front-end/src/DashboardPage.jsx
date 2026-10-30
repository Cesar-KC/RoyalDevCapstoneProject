import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { buildCategoryRows, groupTotals, monthSummary } from "./budgetMath";

// Shared looks (same values as the login and register pages)
const NAVY = "text-[#1b2559]";
const cardClass = "rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60";
const linkClass = "text-sm font-semibold text-[#3563e3] hover:underline";
const buttonLinkClass =
  "inline-block rounded-xl bg-[#3563e3] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2b54cc]";

// Colors for the small square next to each recent transaction, by category kind
const KIND_BADGE = {
  need: "bg-blue-50 text-blue-700",
  want: "bg-amber-50 text-amber-700",
  income: "bg-emerald-50 text-emerald-700",
};

// The user's local month, e.g. "2026-10"
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-10" -> "October 2026"
function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// "2026-10-29" -> "Oct 29". Built in local time on purpose:
// new Date("2026-10-29") is read as UTC midnight, which is Oct 28 in Kansas City.
function shortDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDollars(amount) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Top bar: app name on the left, pill navigation on the right
function Navbar({ onLogout }) {
  // NavLink tells us if its link is the current page, so the active pill can be highlighted
  const pillClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive ? "bg-blue-50 text-[#3563e3]" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <span className={`text-lg font-semibold uppercase tracking-[0.25em] ${NAVY}`}>Budget App</span>
      <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <NavLink to="/dashboard" className={pillClass}>
          Home
        </NavLink>
        <NavLink to="/budget" className={pillClass}>
          Budget
        </NavLink>
        <NavLink to="/transactions" className={pillClass}>
          Transactions
        </NavLink>
        <button
          onClick={onLogout}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}

// One "Needs" / "Wants" row: dot, amounts, percent, and a progress bar
function ProgressRow({ label, dotClass, barClass, totals }) {
  const over = totals.left < 0;
  let percent = 0;
  if (totals.planned > 0) percent = (totals.spent / totals.planned) * 100;
  else if (totals.spent > 0) percent = 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          <span className={`font-semibold ${NAVY}`}>{label}</span>
        </div>
        <span className={`text-sm font-semibold ${over ? "text-red-600" : "text-[#3563e3]"}`}>
          {Math.round(percent)}%
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {formatDollars(totals.spent)} of {formatDollars(totals.planned)} ·{" "}
        {over ? (
          <span className="text-red-600">{formatDollars(-totals.left)} over</span>
        ) : (
          `${formatDollars(totals.left)} left`
        )}
      </p>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
        {/* The width is calculated at runtime, so it uses an inline style, not a Tailwind class */}
        <div
          className={`h-2 rounded-full ${over ? "bg-red-500" : barClass}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function BudgetBlock({ month, budget, budgetFailed, categories, transactions }) {
  const header = (
    <div className="flex items-start justify-between">
      <h2 className={`text-xl ${NAVY}`}>{monthLabel(month)} Budget</h2>
      {budget !== null && !budgetFailed && (
        <Link to="/budget" className={linkClass}>
          View budget
        </Link>
      )}
    </div>
  );

  if (budgetFailed) {
    return (
      <section className={cardClass}>
        {header}
        <p className="mt-4 text-slate-500">Could not load your budget. Please try again.</p>
      </section>
    );
  }

  if (budget === null) {
    return (
      <section className={cardClass}>
        {header}
        <p className="mt-4 text-slate-500">No budget for {monthLabel(month)} yet.</p>
        <Link to="/budget" className={`mt-6 ${buttonLinkClass}`}>
          Create your budget
        </Link>
      </section>
    );
  }

  const rows = buildCategoryRows(categories, budget.allocations, transactions);
  const needs = groupTotals(rows, "need");
  const wants = groupTotals(rows, "want");
  const summary = monthSummary(budget.expected_amount, rows, transactions);

  // Why projected savings differs from the plan (shown on hover over ⓘ)
  const reasons = [`Plan saves ${formatDollars(summary.plannedSavings)}`];
  if (summary.unplannedIncome > 0) {
    reasons.push(`+${formatDollars(summary.unplannedIncome)} unplanned income`);
  }
  if (summary.overspending > 0) {
    reasons.push(`−${formatDollars(summary.overspending)} spent over plan`);
  }
  const explanation = reasons.length > 1 ? reasons.join(" · ") : null;

  return (
    <section className={cardClass}>
      {header}

      <p className="mt-6 text-sm text-slate-500">Projected savings</p>
      <p className="mt-1 flex items-center gap-2">
        <span
          className={`text-4xl font-semibold tracking-tight ${
            summary.projectedSavings < 0 ? "text-red-600" : NAVY
          }`}
        >
          {formatDollars(summary.projectedSavings)}
        </span>
        {explanation && (
          <span title={explanation} className="cursor-help text-slate-400">
            ⓘ
          </span>
        )}
      </p>

      {summary.missingIncome > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Still expecting {formatDollars(summary.missingIncome)} of income. If it doesn't arrive:{" "}
          <span className={summary.worstCaseSavings < 0 ? "font-semibold text-red-600" : "font-semibold"}>
            {formatDollars(summary.worstCaseSavings)}
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <ProgressRow label="Needs" dotClass="bg-blue-600" barClass="bg-blue-600" totals={needs} />
        <ProgressRow label="Wants" dotClass="bg-amber-500" barClass="bg-amber-500" totals={wants} />
      </div>

      <p className="mt-8 border-t border-slate-100 pt-4 text-sm text-slate-500">
        Spent so far: {formatDollars(summary.spent)} of {formatDollars(summary.plannedSpending)}{" "}
        expected
      </p>
    </section>
  );
}

function RecentBlock({ transactions, recentFailed, categoriesById }) {
  const header = (
    <div className="flex items-start justify-between">
      <h2 className={`text-xl ${NAVY}`}>Recent Transactions</h2>
      {transactions.length > 0 && !recentFailed && (
        <Link to="/transactions" className={linkClass}>
          View all transactions
        </Link>
      )}
    </div>
  );

  if (recentFailed) {
    return (
      <section className={cardClass}>
        {header}
        <p className="mt-4 text-slate-500">Could not load your transactions. Please try again.</p>
      </section>
    );
  }

  if (transactions.length === 0) {
    return (
      <section className={cardClass}>
        {header}
        <p className="mt-4 text-slate-500">No transactions yet.</p>
        <Link to="/transactions" className={`mt-6 ${buttonLinkClass}`}>
          Add a transaction
        </Link>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      {header}
      <ul className="mt-4">
        {transactions.map((t) => {
          const category = categoriesById.get(t.category_id);
          const name = category ? category.name : "Uncategorized";
          const badge = category ? KIND_BADGE[category.kind] : "bg-slate-100 text-slate-600";
          const isIncome = t.transaction_type === "income";

          return (
            <li key={t.id} className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${badge}`}
              >
                {name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${NAVY}`}>{name}</p>
                <p className="text-sm text-slate-500">{shortDate(t.transaction_date)}</p>
              </div>
              <span className={`font-semibold ${isIncome ? "text-emerald-600" : NAVY}`}>
                {isIncome ? "+" : "−"}
                {formatDollars(t.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const month = currentMonth();

  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [budget, setBudget] = useState(null);
  const [budgetFailed, setBudgetFailed] = useState(false);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentFailed, setRecentFailed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const responses = await Promise.all([
          fetch("/api/me"),
          fetch("/api/categories"),
          fetch(`/api/budgets?month=${month}`),
          fetch(`/api/transactions?month=${month}`),
          fetch("/api/transactions/recent?limit=5"),
        ]);
        const [meResponse, categoriesResponse, budgetResponse, monthResponse, recentResponse] =
          responses;

        if (responses.some((response) => response.status === 401) || meResponse.status !== 200) {
          navigate("/login", { replace: true });
          return;
        }

        // Read every body first, then update state together, so the page renders once with all data
        const me = await meResponse.json();
        const allCategories = categoriesResponse.status === 200 ? await categoriesResponse.json() : [];
        const savedBudget = budgetResponse.status === 200 ? await budgetResponse.json() : null;
        const thisMonth = monthResponse.status === 200 ? await monthResponse.json() : [];
        const latest = recentResponse.status === 200 ? await recentResponse.json() : [];

        setCategories(allCategories);
        setBudget(savedBudget);
        setBudgetFailed(
          budgetResponse.status !== 200 && budgetResponse.status !== 404
            ? true
            : categoriesResponse.status !== 200 || monthResponse.status !== 200
        );
        setMonthTransactions(thisMonth);
        setRecent(latest);
        setRecentFailed(recentResponse.status !== 200 || categoriesResponse.status !== 200);
        setUser(me);
      } catch {
        setMessage("Could not reach the server. Is the backend running?");
      }
    }
    loadDashboard();
  }, [month, navigate]);

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        {message || "Loading..."}
      </div>
    );
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const budgetCategories = categories.filter((category) => category.kind !== "income");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={handleLogout} />

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <h1 className={`mt-8 text-5xl font-medium tracking-tight ${NAVY}`}>Welcome, {user.name}</h1>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <BudgetBlock
              month={month}
              budget={budget}
              budgetFailed={budgetFailed}
              categories={budgetCategories}
              transactions={monthTransactions}
            />
          </div>
          <div className="lg:col-span-2">
            <RecentBlock
              transactions={recent}
              recentFailed={recentFailed}
              categoriesById={categoriesById}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;