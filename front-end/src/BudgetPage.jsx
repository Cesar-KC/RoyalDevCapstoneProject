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

// Shared looks (same values as the login, register, and dashboard pages)
const NAVY = "text-[#1b2559]";
const cardClass = "rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60";
const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "text-sm font-semibold text-slate-700";
const linkClass = "text-sm font-semibold text-[#3563e3] hover:underline";

// Soft colored boxes for plan messages
const NOTE = {
  warning: "rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800",
  danger: "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700",
  success: "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700",
};

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
    <section className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`text-xl ${NAVY}`}>
          {title} ({pct}%)
        </h2>
        <p className="text-sm text-slate-500">
          Target {formatDollars(target)} · Expected spending {formatDollars(expected)} ·{" "}
          <span className={difference < 0 ? "font-semibold text-amber-700" : ""}>{status}</span>
        </p>
      </div>

      {onChange ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.id} className="flex flex-col gap-2">
              <span className={labelClass}>{category.name}</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={values[category.id] ?? ""}
                onChange={(event) => onChange(category.id, event.target.value)}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100">
          {categories.map((category) => (
            <li key={category.id} className="flex justify-between py-3">
              <span className="text-slate-600">{category.name}</span>
              <span className={`font-semibold ${NAVY}`}>{formatDollars(amountFor(category.id))}</span>
            </li>
          ))}
        </ul>
      )}

      {difference < 0 && (
        <p className={`mt-6 ${NOTE.warning}`}>
          You planned {formatDollars(-difference)} more for {title.toLowerCase()} than your {pct}%
          target.
        </p>
      )}
    </section>
  );
}

// The savings card, with a red / amber / green message
function SavingsPlan({ income, savingsPct, expectedSpending }) {
  const target = roundCents((income * savingsPct) / 100);
  const planned = roundCents(income - expectedSpending);

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`text-xl ${NAVY}`}>Savings ({savingsPct}%)</h2>
        <p className="text-sm text-slate-500">
          Target {formatDollars(target)} · Expected savings {formatDollars(planned)}
        </p>
      </div>
      {planned < 0 && (
        <p className={`mt-4 ${NOTE.danger}`}>
          Your plan allocates {formatDollars(-planned)} more than your income.
        </p>
      )}
      {planned >= 0 && planned < target && (
        <p className={`mt-4 ${NOTE.warning}`}>
          Your plan saves {formatDollars(planned)}, {formatDollars(target - planned)} less than your{" "}
          {formatDollars(target)} savings target.
        </p>
      )}
      {planned >= target && (
        <p className={`mt-4 ${NOTE.success}`}>
          {planned === target
            ? "Your plan meets your savings target exactly."
            : `Your plan saves ${formatDollars(planned - target)} more than your ${formatDollars(target)} savings target.`}
        </p>
      )}
    </section>
  );
}

function TotalRow({ label, totals }) {
  return (
    <tr className={`border-t border-slate-200 font-semibold ${NAVY}`}>
      <td className="py-3">{label}</td>
      <td className="py-3 text-right">{formatDollars(totals.spent)}</td>
      <td className={`py-3 text-right ${totals.left < 0 ? "text-red-600" : ""}`}>
        {formatDollars(totals.left)}
      </td>
    </tr>
  );
}

// One box in the Summary card
function Stat({ label, value, valueClass = NAVY, note, children }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-2">
        <span className={`text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</span>
        {children}
      </p>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
    </div>
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
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
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-4xl px-6 py-12">
          <h1 className={`text-5xl font-medium tracking-tight ${NAVY}`}>Budget</h1>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              {monthLabel(budget.month)} Expected Budget Allowance:{" "}
              <span className={`font-semibold ${NAVY}`}>{formatDollars(income)}</span>
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              Plan:{" "}
              <span className={`font-semibold ${NAVY}`}>
                {savedPlan ? savedPlan.name : "Custom"} ({budget.needs_pct} / {budget.wants_pct} /{" "}
                {budget.savings_pct})
              </span>
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-6">
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

            <section className={cardClass}>
              <h2 className={`text-xl ${NAVY}`}>Actual Spending</h2>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 text-right font-medium">Spent</th>
                    <th className="py-2 text-right font-medium">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="py-3 text-slate-700">{row.name}</td>
                      <td className={`py-3 text-right ${NAVY}`}>{formatDollars(row.spent)}</td>
                      <td className={`py-3 text-right ${row.left < 0 ? "font-semibold text-red-600" : NAVY}`}>
                        {formatDollars(row.left)}
                      </td>
                    </tr>
                  ))}
                  <TotalRow label="Needs total" totals={needs} />
                  <TotalRow label="Wants total" totals={wants} />
                </tbody>
              </table>
            </section>

            <section className={cardClass}>
              <h2 className={`text-xl ${NAVY}`}>Summary</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Income received"
                  value={formatDollars(summary.received)}
                  note={`of ${formatDollars(income)} expected`}
                />
                <Stat
                  label="Spent so far"
                  value={formatDollars(summary.spent)}
                  note={`of ${formatDollars(summary.plannedSpending)} expected`}
                />
                <Stat
                  label="Projected savings"
                  value={formatDollars(summary.projectedSavings)}
                  valueClass={summary.projectedSavings < 0 ? "text-red-600" : NAVY}
                >
                  {explanation && (
                    <span title={explanation} className="cursor-help text-slate-400">
                      ⓘ
                    </span>
                  )}
                </Stat>
              </div>
              {summary.missingIncome > 0 && (
                <p className={`mt-4 ${NOTE.warning}`}>
                  Still expecting {formatDollars(summary.missingIncome)} of income. If it doesn't arrive:{" "}
                  <span className={summary.worstCaseSavings < 0 ? "font-semibold text-red-600" : "font-semibold"}>
                    {formatDollars(summary.worstCaseSavings)}
                  </span>
                </p>
              )}
            </section>
          </div>

          {message && <p className="mt-6 text-sm text-slate-700">{message}</p>}
          <p className="mt-8">
            <Link to="/dashboard" className={linkClass}>
              Back to dashboard
            </Link>
          </p>
        </main>
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
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className={`text-5xl font-medium tracking-tight ${NAVY}`}>
          Create your budget for {monthLabel(month)}
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <section className={cardClass}>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Expected budget for {monthLabel(month)} ($)</span>
              <input
                type="number"
                name="expectedAmount"
                min="1"
                max="1000000000"
                step="1"
                value={form.expectedAmount}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </label>

            <fieldset className="mt-8">
              <legend className={labelClass}>Choose your budgeting model</legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {PLANS.map((plan) => {
                  const selected = form.plan === plan.id;
                  return (
                    <label
                      key={plan.id}
                      className={`cursor-pointer rounded-2xl border p-5 transition ${
                        selected
                          ? "border-[#3563e3] bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${selected ? "text-[#3563e3]" : NAVY}`}>
                          {plan.name}
                        </span>
                        <input
                          type="radio"
                          name="plan"
                          value={plan.id}
                          checked={selected}
                          onChange={handleChange}
                          className="h-4 w-4 accent-[#3563e3]"
                        />
                      </div>
                      <p className={`mt-3 text-2xl font-semibold tracking-tight ${NAVY}`}>
                        {plan.needs} / {plan.wants} / {plan.savings}
                      </p>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

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
            <p className="text-slate-500">Enter your expected budget to plan your spending.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#3563e3] py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2b54cc] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save my budget"}
          </button>
        </form>

        {message && <p className="mt-6 text-sm text-slate-700">{message}</p>}
        <p className="mt-8">
          <Link to="/dashboard" className={linkClass}>
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

export default BudgetPage;