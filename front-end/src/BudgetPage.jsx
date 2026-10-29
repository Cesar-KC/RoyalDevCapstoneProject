import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

// Display copy of the plans, for the live preview only.
// The server keeps its own table and decides the real percentages.
const PLANS = [
  { id: "balanced", name: "Balanced", needs: 50, wants: 30, savings: 20 },
  { id: "save_more", name: "Save more", needs: 40, wants: 20, savings: 40 },
  { id: "essentials", name: "Essentials", needs: 60, wants: 20, savings: 20 },
];

const SUCCESS_COLOR = "#15803d";
const WARNING_COLOR = "#b45309";
const DANGER_COLOR = "#b91c1c";


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

// One group (Needs or Wants): editable when onChange is given, read-only otherwise
function AllocationGroup({ title, pct, target, categories, amountFor, values, onChange }) {
  const allocated = categories.reduce((sum, category) => sum + amountFor(category.id), 0);
  const difference = target - allocated;

  return (
    <fieldset>
      <legend>
        {title} ({pct}%): {formatDollars(target)} target · {formatDollars(allocated)} allocated ·{" "}
        {difference >= 0
          ? `${formatDollars(difference)} left`
          : `${formatDollars(-difference)} over`}
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
          {title} is {formatDollars(-difference)} over your {pct}% target.
        </p>
      )}
    </fieldset>
  );
}

function SavingsSummary({ income, savingsPct, totalAllocated }) {
  const target = (income * savingsPct) / 100;
  const planned = income - totalAllocated;

  return (
    <div>
      <p>
        Savings target ({savingsPct}%): {formatDollars(target)} · Planned savings:{" "}
        {formatDollars(planned)}
      </p>
      {planned < 0 && (
        <p style={{ color: DANGER_COLOR }}>
          Your allocations are {formatDollars(-planned)} more than your income.
        </p>
      )}
      {planned >= 0 && planned < target && (
        <p style={{ color: WARNING_COLOR }}>
          You'll save {formatDollars(planned)}, {formatDollars(target - planned)} below your{" "}
          {formatDollars(target)} target.
        </p>
      )}
      {planned >= target && (
        <p style={{ color: SUCCESS_COLOR }}>
          {planned === target
            ? "On track: right on your savings target."
            : `On track: ${formatDollars(planned - target)} above your ${formatDollars(target)} target.`}
        </p>
      )}
    </div>
  );
}

// Needs + Wants + Savings, used by both the form and the saved view
function BudgetBreakdown({ income, needsPct, wantsPct, savingsPct, categories, amountFor, values, onChange }) {
  const needs = categories.filter((category) => category.kind === "need");
  const wants = categories.filter((category) => category.kind === "want");
  const totalAllocated = categories.reduce((sum, category) => sum + amountFor(category.id), 0);

  return (
    <>
      <AllocationGroup
        title="Needs"
        pct={needsPct}
        target={(income * needsPct) / 100}
        categories={needs}
        amountFor={amountFor}
        values={values}
        onChange={onChange}
      />
      <AllocationGroup
        title="Wants"
        pct={wantsPct}
        target={(income * wantsPct) / 100}
        categories={wants}
        amountFor={amountFor}
        values={values}
        onChange={onChange}
      />
      <SavingsSummary income={income} savingsPct={savingsPct} totalAllocated={totalAllocated} />
    </>
  );
}

function BudgetPage() {
  const navigate = useNavigate();
  const month = currentMonth();

  const [categories, setCategories] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ expectedAmount: "", plan: "balanced" });
  const [allocations, setAllocations] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // On open: load categories and this month's budget at the same time
  useEffect(() => {
    async function loadPage() {
      try {
        const [categoriesResponse, budgetResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/budgets?month=${month}`),
        ]);

        if (categoriesResponse.status === 401 || budgetResponse.status === 401) {
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
      setMessage("Enter a whole-dollar income from $1 to $1,000,000,000.");
      return;
    }
    if (!allocationsValid) {
      setMessage("Allocations must be whole dollars, $0 or more.");
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

  // Saved view (read-only)
  if (budget !== null) {
    const savedPlan = PLANS.find(
      (plan) =>
        plan.needs === budget.needs_pct &&
        plan.wants === budget.wants_pct &&
        plan.savings === budget.savings_pct
    );
    const savedAmounts = new Map(
      budget.allocations.map((allocation) => [allocation.category_id, allocation.amount])
    );

    return (
      <div>
        <h1>Your budget for {monthLabel(budget.month)}</h1>
        <p>Monthly income: {formatDollars(budget.expected_amount)}</p>
        <p>
          Plan: {savedPlan ? savedPlan.name : "Custom"} ({budget.needs_pct} /{" "}
          {budget.wants_pct} / {budget.savings_pct})
        </p>
        <BudgetBreakdown
          income={budget.expected_amount}
          needsPct={budget.needs_pct}
          wantsPct={budget.wants_pct}
          savingsPct={budget.savings_pct}
          categories={categories}
          amountFor={(categoryId) => savedAmounts.get(categoryId) ?? 0}
        />
        {message && <p>{message}</p>}
      </div>
    );
  }

  // Form: income → plan → allocations, with live targets and warnings
  return (
    <div>
      <h1>Create your budget for {monthLabel(month)}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Monthly take-home income ($){" "}
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
          <BudgetBreakdown
            income={amount}
            needsPct={selectedPlan.needs}
            wantsPct={selectedPlan.wants}
            savingsPct={selectedPlan.savings}
            categories={categories}
            amountFor={(categoryId) => toAmount(allocations[categoryId])}
            values={allocations}
            onChange={handleAllocationChange}
          />
        ) : (
          <p>Enter your income to set your allocations.</p>
        )}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save my budget"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

export default BudgetPage;