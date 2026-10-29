import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { buildCategoryRows, groupTotals, monthSummary } from "./budgetMath";

const INCOME_COLOR = "#15803d";
const WARNING_COLOR = "#b45309";
const DANGER_COLOR = "#b91c1c";

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

// "Needs: $52.37 spent of $900.00 planned · $847.63 left"
function ProgressLine({ label, totals }) {
  return (
    <p>
      {label}: {formatDollars(totals.spent)} spent of {formatDollars(totals.planned)} planned ·{" "}
      {totals.left >= 0 ? (
        `${formatDollars(totals.left)} left`
      ) : (
        <span style={{ color: DANGER_COLOR }}>{formatDollars(-totals.left)} over</span>
      )}
    </p>
  );
}

function BudgetBlock({ month, budget, budgetFailed, categories, transactions }) {
  const title = <h2>{monthLabel(month)} Budget</h2>;

  if (budgetFailed) {
    return (
      <section>
        {title}
        <p>Could not load your budget. Please try again.</p>
      </section>
    );
  }

  if (budget === null) {
    return (
      <section>
        {title}
        <p>No budget for {monthLabel(month)} yet.</p>
        <p>
          <Link to="/budget">Create your budget</Link>
        </p>
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
    <section>
      {title}
      <p>
        Projected savings:{" "}
        <span style={summary.projectedSavings < 0 ? { color: DANGER_COLOR } : undefined}>
          {formatDollars(summary.projectedSavings)}
        </span>
        {explanation && (
          <span title={explanation} style={{ cursor: "help" }}>
            {" "}
            ⓘ
          </span>
        )}
      </p>
      {summary.missingIncome > 0 && (
        <p style={{ color: WARNING_COLOR }}>
          Still expecting {formatDollars(summary.missingIncome)} of income. If it doesn't arrive:{" "}
          <span style={summary.worstCaseSavings < 0 ? { color: DANGER_COLOR } : undefined}>
            {formatDollars(summary.worstCaseSavings)}
          </span>
        </p>
      )}
      <ProgressLine label="Needs" totals={needs} />
      <ProgressLine label="Wants" totals={wants} />
      <p>
        Spent so far: {formatDollars(summary.spent)} of {formatDollars(summary.plannedSpending)}{" "}
        expected
      </p>
      <p>
        <Link to="/budget">View budget</Link>
      </p>
    </section>
  );
}

function RecentBlock({ transactions, recentFailed, categoryNames }) {
  const title = <h2>Recent Transactions</h2>;

  if (recentFailed) {
    return (
      <section>
        {title}
        <p>Could not load your transactions. Please try again.</p>
      </section>
    );
  }

  if (transactions.length === 0) {
    return (
      <section>
        {title}
        <p>No transactions yet.</p>
        <p>
          <Link to="/transactions">Add a transaction</Link>
        </p>
      </section>
    );
  }

  return (
    <section>
      {title}
      <table style={{ margin: "0 auto" }}>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{shortDate(t.transaction_date)}</td>
              <td>{categoryNames.get(t.category_id) ?? "Uncategorized"}</td>
              <td style={t.transaction_type === "income" ? { color: INCOME_COLOR } : undefined}>
                {t.transaction_type === "income" ? "+" : "−"}
                {formatDollars(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link to="/transactions">View all transactions</Link>
      </p>
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
          fetch("/api/transactions/recent?limit=3"),
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
    return <p>{message || "Loading..."}</p>;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const budgetCategories = categories.filter((category) => category.kind !== "income");

  return (
    <div>
      <h1>Home</h1>
      <h2>Welcome, {user.name}</h2>
      <BudgetBlock
        month={month}
        budget={budget}
        budgetFailed={budgetFailed}
        categories={budgetCategories}
        transactions={monthTransactions}
      />
      <RecentBlock
        transactions={recent}
        recentFailed={recentFailed}
        categoryNames={categoryNames}
      />
      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #444" }}>
        <nav>
          <Link to="/budget">Budget</Link> · <Link to="/transactions">Transactions</Link>
        </nav>
        <p>
          <button onClick={handleLogout}>Log out</button>
        </p>
      </footer>
    </div>
  );
}

export default DashboardPage;