import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

const INCOME_COLOR = "#15803d";
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/; // e.g. 12, 12.5, 12.49

// "2026-10" for the user's local month
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-10-29" for the user's local day
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// shiftMonth("2026-12", 1) -> "2027-01"
function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

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

function emptyForm() {
  return {
    transactionType: "expense",
    amount: "",
    categoryId: "",
    description: "",
    transactionDate: today(),
  };
}

// Newest date first; same day -> most recently added first (matches the API)
function sortNewestFirst(list) {
  return [...list].sort((a, b) =>
    a.transaction_date === b.transaction_date
      ? b.id - a.id
      : b.transaction_date.localeCompare(a.transaction_date)
  );
}

function TransactionsPage() {
  const navigate = useNavigate();

  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Categories: load once
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories");
        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (response.status === 200) {
          setCategories(await response.json());
        } else {
          setMessage("Could not load categories. Please try again.");
        }
      } catch {
        setMessage("Could not reach the server. Is the backend running?");
      }
    }
    loadCategories();
  }, [navigate]);

  // Transactions: load again whenever the month changes
  useEffect(() => {
    let ignore = false;

    async function loadTransactions() {
      setLoading(true);
      try {
        const response = await fetch(`/api/transactions?month=${month}`);
        if (ignore) return;
        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (response.status === 200) {
          const data = await response.json();
          if (!ignore) setTransactions(data);
        } else {
          setMessage("Could not load transactions. Please try again.");
        }
      } catch {
        if (!ignore) setMessage("Could not reach the server. Is the backend running?");
      }
      if (!ignore) setLoading(false);
    }

    loadTransactions();
    return () => {
      ignore = true;
    };
  }, [month, navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    if (name === "transactionType") {
      // Different type = different category list, so clear the choice
      setForm({ ...form, transactionType: value, categoryId: "" });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categoryOptions = categories.filter((category) =>
    form.transactionType === "income" ? category.kind === "income" : category.kind !== "income"
  );

  const incomeTotal = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const amount = Number(form.amount);
    if (!AMOUNT_PATTERN.test(form.amount) || amount <= 0 || amount > 1_000_000_000) {
      setMessage("Enter an amount greater than $0 with at most 2 decimals.");
      return;
    }
    if (form.categoryId === "") {
      setMessage("Choose a category.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_type: form.transactionType,
          amount: form.amount, // sent as text ("52.37") so the server keeps it exact
          category_id: Number(form.categoryId),
          description: form.description,
          transaction_date: form.transactionDate,
        }),
      });

      if (response.status === 201) {
        const saved = await response.json();
        const savedMonth = saved.transaction_date.slice(0, 7);
        if (savedMonth === month) {
          setTransactions(sortNewestFirst([saved, ...transactions]));
          setMessage("Transaction added.");
        } else {
          setMessage(`Transaction added to ${monthLabel(savedMonth)}.`);
        }
        // Keep type and date (handy for entering several), clear the rest
        setForm({ ...emptyForm(), transactionType: form.transactionType, transactionDate: form.transactionDate });
      } else if (response.status === 401) {
        navigate("/login", { replace: true });
      } else if (response.status === 422) {
        setMessage("Please check the amount, category, and date.");
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setMessage("Could not reach the server. Is the backend running?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Transactions</h1>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Type</legend>
          <label>
            <input
              type="radio"
              name="transactionType"
              value="expense"
              checked={form.transactionType === "expense"}
              onChange={handleChange}
            />
            Expense
          </label>
          <label>
            <input
              type="radio"
              name="transactionType"
              value="income"
              checked={form.transactionType === "income"}
              onChange={handleChange}
            />
            Income
          </label>
        </fieldset>

        <label>
          Amount ($){" "}
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Category{" "}
          <select name="categoryId" value={form.categoryId} onChange={handleChange} required>
            <option value="">Choose a category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date{" "}
          <input
            type="date"
            name="transactionDate"
            value={form.transactionDate}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Notes (optional){" "}
          <input
            type="text"
            name="description"
            maxLength={255}
            value={form.description}
            onChange={handleChange}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add transaction"}
        </button>
      </form>

      {message && <p>{message}</p>}

      <h2>
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
          ←
        </button>{" "}
        {monthLabel(month)}{" "}
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
          →
        </button>
      </h2>
      <p>
        Income: {formatDollars(incomeTotal)} · Expenses: {formatDollars(expenseTotal)}
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : transactions.length === 0 ? (
        <p>No transactions this month.</p>
      ) : (
        <table style={{ margin: "0 auto" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Notes</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.transaction_date}</td>
                <td>{categoryNames.get(t.category_id) ?? "Uncategorized"}</td>
                <td>{t.description ?? ""}</td>
                <td style={{ color: t.transaction_type === "income" ? INCOME_COLOR : undefined }}>
                  {t.transaction_type === "income" ? "+" : "−"}
                  {formatDollars(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    <p>
        <Link to="/dashboard">Back to dashboard</Link>
    </p>
    </div>
  );
}

export default TransactionsPage;