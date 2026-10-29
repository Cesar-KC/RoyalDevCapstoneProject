import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

// Display copy of the plans, for the live preview only.
// The server keeps its own table and decides the real percentages.
const PLANS = [
  { id: "balanced", name: "Balanced", needs: 50, wants: 30, savings: 20 },
  { id: "save_more", name: "Save more", needs: 40, wants: 20, savings: 40 },
  { id: "essentials", name: "Essentials", needs: 60, wants: 20, savings: 20 },
];

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

function Targets({ amount, needsPct, wantsPct, savingsPct }) {
  return (
    <ul>
      <li>Needs ({needsPct}%): {formatDollars((amount * needsPct) / 100)}</li>
      <li>Wants ({wantsPct}%): {formatDollars((amount * wantsPct) / 100)}</li>
      <li>Savings target ({savingsPct}%): {formatDollars((amount * savingsPct) / 100)}</li>
    </ul>
  );
}

function BudgetPage() {
  const navigate = useNavigate();
  const month = currentMonth();

  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ expectedAmount: "", plan: "balanced" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Step 2: on open, load this month's budget
  useEffect(() => {
    async function loadBudget() {
      try {
        const response = await fetch(`/api/budgets?month=${month}`);
        if (response.status === 200) {
          setBudget(await response.json());
        } else if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        } else if (response.status !== 404) {
          setMessage("Could not load your budget. Please try again.");
        }
      } catch {
        setMessage("Could not reach the server. Is the backend running?");
      }
      setLoading(false);
    }
    loadBudget();
  }, [month, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  const amount = Number(form.expectedAmount);
  const isValidAmount =
    Number.isInteger(amount) && amount >= 1 && amount <= 1_000_000_000;
  const selectedPlan = PLANS.find((plan) => plan.id === form.plan);

  // Step 5: save
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!isValidAmount) {
      setMessage("Enter a whole-dollar amount from $1 to $1,000,000,000.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, expected_amount: amount, plan: form.plan }),
      });

      if (response.status === 201) {
        setBudget(await response.json());
      } else if (response.status === 401) {
        navigate("/login", { replace: true });
      } else if (response.status === 409) {
        setMessage("You already have a budget for this month. Refresh to see it.");
      } else if (response.status === 422) {
        setMessage("Please check the amount and plan.");
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

  // Step 6: saved view (read-only)
  if (budget !== null) {
    const savedPlan = PLANS.find(
      (plan) =>
        plan.needs === budget.needs_pct &&
        plan.wants === budget.wants_pct &&
        plan.savings === budget.savings_pct
    );

    return (
      <div>
        <h1>Your budget for {monthLabel(budget.month)}</h1>
        <p>Monthly income: {formatDollars(budget.expected_amount)}</p>
        <p>
          Plan: {savedPlan ? savedPlan.name : "Custom"} ({budget.needs_pct} /{" "}
          {budget.wants_pct} / {budget.savings_pct})
        </p>
        <Targets
          amount={budget.expected_amount}
          needsPct={budget.needs_pct}
          wantsPct={budget.wants_pct}
          savingsPct={budget.savings_pct}
        />
      </div>
    );
  }

  // Steps 3–4: the form, with live targets
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

        {isValidAmount && (
          <Targets
            amount={amount}
            needsPct={selectedPlan.needs}
            wantsPct={selectedPlan.wants}
            savingsPct={selectedPlan.savings}
          />
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