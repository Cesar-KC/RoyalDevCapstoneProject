import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { buildCategoryRows, groupTotals, monthSummary, roundCents } from "./budgetMath";

// Display copy of the plans, for the live preview only.
// The server keeps its own table and decides the real percentages.
const PLANS = [
  { id: "balanced", name: "Balanced", needs: 50, wants: 30, savings: 20 },
  { id: "save_more", name: "Save more", needs: 40, wants: 20, savings: 40 },
  { id: "essentials", name: "Essentials", needs: 60, wants: 20, savings: 20 },
];

const WARNING_COLOR = "#b45309";
const DANGER_COLOR = "#b91c1c";
const SUCCESS_COLOR = "#15803d";

// The user's local month, e.g. "2026-10"
function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

// "2026-10" -> "October 2026"
function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDollars(amount) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// An empty input counts as $0
function toAmount(value) {
  if (value === undefined || value === "") {
    return 0;
  }
  return Number(value);
}

function isWholeDollars(value, min) {
  return Number.isInteger(value) && value >= min && value <= 1_000_000_000;
}

// One block (Needs or Wants): editable in the form (onChange given), read-only in the saved view
function PlanBlock({ title, pct, target, categories, amountFor, values, onChange }) {
  const expected = roundCents(
    categories.reduce((sum, category) => sum + amountFor(category.id), 0)
  );
  const difference = roundCents(target - expected);
  let status = "on target";
  if (difference > 0) status = `${formatDollars(difference)} under target`;
  if (difference < 0) status = `${formatDollars(-difference)} over target`;

  return (
    <fieldset>
      <legend>
        {title} ({pct}%): Target {formatDollars(target)} · Expected spending{" "}
        {formatDollars(expected)} · {status}
      </legend>

      {categories.map((category) => (
        <div key={category.id}>
          <label>
            {category.name}{" "}
            {onChange ? (
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={values[category.id] ?? ""}
                onChange={(event) => onChange(category.id, event.target.value)}
              />
            ) : (
              formatDollars(amountFor(category.id))
            )}
          </label>
        </div>
      ))}

      {difference < 0 && (
        <p style={{ color: WARNING_COLOR }}>
          You planned {formatDollars(-difference)} more for {title.toLowerCase()} than your {pct}%
          target.
        </p>
      )}
    </fieldset>
  );
}

// The savings plan line, with a red / amber / green message
function SavingsPlan({ income, savingsPct, expectedSpending }) {
  const target = roundCents((income * savingsPct) / 100);
  const planned = roundCents(income - expectedSpending);

  return (
    <>
      <p>
        Savings ({savingsPct}%): Target {formatDollars(target)} · Expected savings{" "}
        {formatDollars(planned)}
      </p>
      {planned < 0 && (
        <p style={{ color: DANGER_COLOR }}>
          Your plan allocates {formatDollars(-planned)} more than your income.
        </p>
      )}
      {planned >= 0 && planned < target && (
        <p style={{ color: WARNING_COLOR }}>
          Your plan saves {formatDollars(planned)}, {formatDollars(target - planned)} less than your{" "}
          {formatDollars(target)} savings target.
        </p>
      )}
      {planned >= target && (
        <p style={{ color: SUCCESS_COLOR }}>
          {planned === target
            ? "Your plan meets your savings target exactly."
            : `Your plan saves ${formatDollars(planned - target)} more than your ${formatDollars(target)} savings target.`}
        </p>
      )}
    </>
  );
}

function TotalRow({ label, totals }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
      </td>
      <td>
        <strong>{formatDollars(totals.spent)}</strong>
      </td>
      <td style={totals.left < 0 ? { color: DANGER_COLOR } : undefined}>
        <strong>{formatDollars(totals.left)}</strong>
      </td>
    </tr>
  );
}

function BudgetPage() {
  const navigate = useNavigate();
  const month = currentMonth();

  const [categories, setCategories] = useState([]);
  const [budget, setBudget] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ expectedAmount: "", plan: "balanced" });
  const [allocations, setAllocations] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // On open: categories, this month's budget, and this month's transactions, all at once
  useEffect(() => {
    async function loadPage() {
      try {
        const [categoriesResponse, budgetResponse, transactionsResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/budgets?month=${month}`),
          fetch(`/api/transactions?month=${month}`),
        ]);

        if (
          categoriesResponse.status === 401 ||
          budgetResponse.status === 401 ||
          transactionsResponse.status === 401
        ) {
          navigate("/login", { replace: true });
          return;
        }

        if (categoriesResponse.status === 200) {
          const allCategories = await categoriesResponse.json();
          setCategories(allCategories.filter((category) => category.kind !== "income"));
        } else {
          setMessage("Could not load categories. Please try again.");
        }

        if (budgetResponse.status === 200) {
          setBudget(await budgetResponse.json());
        } else if (budgetResponse.status !== 404) {
          setMessage("Could not load your budget. Please try again.");
        }

        if (transactionsResponse.status === 200) {
          setTransactions(await transactionsResponse.json());
        } else {
          setMessage("Could not load this month's transactions. Please try again.");
        }
      } catch {
        setMessage("Could not reach the server. Is the backend running?");
      }
      setLoading(false);
    }
    loadPage();
  }, [month, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function handleAllocationChange(categoryId, value) {
    setAllocations({ ...allocations, [categoryId]: value });
  }

  const amount = Number(form.expectedAmount);
  const isValidAmount = isWholeDollars(amount, 1);
  const selectedPlan = PLANS.find((plan) => plan.id === form.plan);
  const allocationsValid = categories.every((category) =>
    isWholeDollars(toAmount(allocations[category.id]), 0)
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!isValidAmount) {
      setMessage("Enter a whole-dollar budget from $1 to $1,000,000,000.");
      return;
    }
    if (!allocationsValid) {
      setMessage("Expected spending must be whole dollars, $0 or more.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          expected_amount: amount,
          plan: form.plan,
          allocations: categories.map((category) => ({
            category_id: category.id,
            amount: toAmount(allocations[category.id]),
          })),
        }),
      });

      if (response.status === 201) {
        setBudget(await response.json());
      } else if (response.status === 401) {
        navigate("/login", { replace: true });
      } else if (response.status === 409) {
        setMessage("You already have a budget for this month. Refresh to see it.");
      } else if (response.status === 422) {
        setMessage("Please check the amounts and plan.");
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setMessage("Could not reach the server. Is the backend running?");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  // ---------- Saved view: plan + this month so far ----------
  if (budget !== null) {
    const savedPlan = PLANS.find(
      (plan) =>
        plan.needs === budget.needs_pct &&
        plan.wants === budget.wants_pct &&
        plan.savings === budget.savings_pct
    );
    const income = budget.expected_amount;
    const savedAmounts = new Map(
      budget.allocations.map((allocation) => [allocation.category_id, allocation.amount])
    );
    const rows = buildCategoryRows(categories, budget.allocations, transactions);
    const needs = groupTotals(rows, "need");
    const wants = groupTotals(rows, "want");
    const summary = monthSummary(income, rows, transactions);

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
      <div>
        <h1>Budget</h1>
        <p>
          {monthLabel(budget.month)} Expected Budget: {formatDollars(income)}
        </p>
        <p>
          Plan: {savedPlan ? savedPlan.name : "Custom"} ({budget.needs_pct} / {budget.wants_pct} /{" "}
          {budget.savings_pct})
        </p>

        <PlanBlock
          title="Needs"
          pct={budget.needs_pct}
          target={roundCents((income * budget.needs_pct) / 100)}
          categories={categories.filter((category) => category.kind === "need")}
          amountFor={(categoryId) => savedAmounts.get(categoryId) ?? 0}
        />
        <PlanBlock
          title="Wants"
          pct={budget.wants_pct}
          target={roundCents((income * budget.wants_pct) / 100)}
          categories={categories.filter((category) => category.kind === "want")}
          amountFor={(categoryId) => savedAmounts.get(categoryId) ?? 0}
        />
        <SavingsPlan
          income={income}
          savingsPct={budget.savings_pct}
          expectedSpending={summary.plannedSpending}
        />

        <h2>Actual Spending:</h2>
        <table style={{ margin: "0 auto" }}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Spent</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatDollars(row.spent)}</td>
                <td style={row.left < 0 ? { color: DANGER_COLOR } : undefined}>
                  {formatDollars(row.left)}
                </td>
              </tr>
            ))}
            <TotalRow label="Needs total" totals={needs} />
            <TotalRow label="Wants total" totals={wants} />
          </tbody>
        </table>
        
        <h2>Summary:</h2>
        <p>
          Income received: {formatDollars(summary.received)} of {formatDollars(income)} expected
        </p>
        <p>
          Spent so far: {formatDollars(summary.spent)} of {formatDollars(summary.plannedSpending)}{" "}
          expected
        </p>
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

        {message && <p>{message}</p>}
      <p>
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
      </div>
    );
  }

  // ---------- Form: budget → plan → expected spending, with live plan checks ----------
  const needsCategories = categories.filter((category) => category.kind === "need");
  const wantsCategories = categories.filter((category) => category.kind === "want");
  const formExpectedSpending = roundCents(
    categories.reduce((sum, category) => sum + toAmount(allocations[category.id]), 0)
  );

  return (
    <div>
      <h1>Create your budget for {monthLabel(month)}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Expected budget for {monthLabel(month)} ($){" "}
          <input
            type="number"
            name="expectedAmount"
            min="1"
            max="1000000000"
            step="1"
            value={form.expectedAmount}
            onChange={handleChange}
            required
          />
        </label>

        <fieldset>
          <legend>Choose your budgeting model</legend>
          {PLANS.map((plan) => (
            <label key={plan.id}>
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={form.plan === plan.id}
                onChange={handleChange}
              />
              {plan.name} ({plan.needs} / {plan.wants} / {plan.savings})
            </label>
          ))}
        </fieldset>

        {isValidAmount ? (
          <>
            <PlanBlock
              title="Needs"
              pct={selectedPlan.needs}
              target={roundCents((amount * selectedPlan.needs) / 100)}
              categories={needsCategories}
              amountFor={(categoryId) => toAmount(allocations[categoryId])}
              values={allocations}
              onChange={handleAllocationChange}
            />
            <PlanBlock
              title="Wants"
              pct={selectedPlan.wants}
              target={roundCents((amount * selectedPlan.wants) / 100)}
              categories={wantsCategories}
              amountFor={(categoryId) => toAmount(allocations[categoryId])}
              values={allocations}
              onChange={handleAllocationChange}
            />
            <SavingsPlan
              income={amount}
              savingsPct={selectedPlan.savings}
              expectedSpending={formExpectedSpending}
            />
          </>
        ) : (
          <p>Enter your expected budget to plan your spending.</p>
        )}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save my budget"}
        </button>
      </form>

      {message && <p>{message}</p>}
      <p>
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}

export default BudgetPage;