import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/; // e.g. 12, 12.5, 12.49

// Shared looks (same values as the other pages)
const NAVY = "text-[#1b2559]";
const cardClass = "rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "text-sm font-semibold text-slate-700";
const linkClass = "text-sm font-semibold text-[#3563e3] hover:underline";
const arrowButtonClass =
  "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-slate-900";

// Per-type looks for the two blocks
const TYPE_STYLE = {
  income: {
    title: "Income",
    sign: "+",
    icon: "bg-emerald-50 text-emerald-700",
    button: "bg-emerald-600 shadow-emerald-500/30 hover:bg-emerald-700",
  },
  expense: {
    title: "Expenses",
    sign: "−",
    icon: "bg-red-50 text-red-600",
    button: "bg-[#3563e3] shadow-blue-500/30 hover:bg-[#2b54cc]",
  },
};

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

// The type is no longer part of the form: each block has a fixed type
function emptyForm() {
  return {
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

// One "add" form with a fixed type ("income" or "expense").
// Same validation and same POST as before; after saving it hands the new transaction to the page.
function TransactionForm({ type, categories, month, onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryOptions = categories.filter((category) =>
    type === "income" ? category.kind === "income" : category.kind !== "income"
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

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
          transaction_type: type,
          amount: form.amount, // sent as text ("52.37") so the server keeps it exact
          category_id: Number(form.categoryId),
          description: form.description,
          transaction_date: form.transactionDate,
        }),
      });

      if (response.status === 201) {
        const saved = await response.json();
        const savedMonth = saved.transaction_date.slice(0, 7);
        onSaved(saved);
        setMessage(
          savedMonth === month
            ? "Transaction added."
            : `Transaction added to ${monthLabel(savedMonth)}.`
        );
        // Keep the date (handy for entering several), clear the rest
        setForm({ ...emptyForm(), transactionDate: form.transactionDate });
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
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2">
        <span className={labelClass}>Amount ($)</span>
        <input
          type="number"
          name="amount"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={handleChange}
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Category</span>
        <select
          name="categoryId"
          value={form.categoryId}
          onChange={handleChange}
          required
          className={inputClass}
        >
          <option value="">Choose a category</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Date</span>
        <input
          type="date"
          name="transactionDate"
          value={form.transactionDate}
          onChange={handleChange}
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Notes (optional)</span>
        <input
          type="text"
          name="description"
          maxLength={255}
          value={form.description}
          onChange={handleChange}
          className={inputClass}
        />
      </label>

      <div className="flex items-center justify-between gap-4 sm:col-span-2">
        <p className="text-sm text-slate-600">{message}</p>
        <button
          type="submit"
          disabled={saving}
          className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60 ${TYPE_STYLE[type].button}`}
        >
          {saving ? "Saving..." : "Add transaction"}
        </button>
      </div>
    </form>
  );
}

// One block: header with total, the add form, then that type's list for the month
function TransactionBlock({ type, total, categories, month, onSaved, items, loading, categoryNames }) {
  const style = TYPE_STYLE[type];

  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold ${style.icon}`}
          >
            {style.sign}
          </span>
          <h2 className={`text-xl ${NAVY}`}>{style.title}</h2>
        </div>
        <span className={`font-semibold ${NAVY}`}>{formatDollars(total)}</span>
      </div>

      <TransactionForm type={type} categories={categories} month={month} onSaved={onSaved} />

      <div className="mt-8 border-t border-slate-100 pt-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No transactions this month.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-4 py-3">
                {/* min-w-0 lets this column shrink, so long notes can be cut with "…" */}
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${NAVY}`}>
                    {categoryNames.get(t.category_id) ?? "Uncategorized"}
                  </p>
                  {t.description && (
                    <p className="truncate text-sm text-slate-500" title={t.description}>
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`whitespace-nowrap font-semibold ${NAVY}`}>{formatDollars(t.amount)}</p>
                  <p className="whitespace-nowrap text-sm text-slate-500">{t.transaction_date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, valueClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function TransactionsPage() {
  const navigate = useNavigate();

  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  // Called by either form after a successful save
  function handleSaved(saved) {
    if (saved.transaction_date.slice(0, 7) === month) {
      setTransactions((current) => sortNewestFirst([saved, ...current]));
    }
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const incomeItems = transactions.filter((t) => t.transaction_type === "income");
  const expenseItems = transactions.filter((t) => t.transaction_type === "expense");
  const incomeTotal = incomeItems.reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = expenseItems.reduce((sum, t) => sum + t.amount, 0);
  const net = Math.round((incomeTotal - expenseTotal) * 100) / 100;

  // Net activity: green "+" when positive, red "−" when negative, plain at zero
  let netDisplay = { text: formatDollars(0), className: NAVY };
  if (net > 0) netDisplay = { text: `+${formatDollars(net)}`, className: "text-emerald-600" };
  if (net < 0) netDisplay = { text: `−${formatDollars(-net)}`, className: "text-red-600" };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className={`text-5xl font-medium tracking-tight ${NAVY}`}>Transactions</h1>

        <div className="mt-8 flex items-center gap-3">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className={arrowButtonClass}>
            ←
          </button>
          <h2 className={`min-w-44 text-center text-lg font-semibold ${NAVY}`}>{monthLabel(month)}</h2>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className={arrowButtonClass}>
            →
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Income" value={formatDollars(incomeTotal)} valueClass={NAVY} />
          <Stat label="Expenses" value={formatDollars(expenseTotal)} valueClass={NAVY} />
          <Stat label="Net activity" value={netDisplay.text} valueClass={netDisplay.className} />
        </div>

        {message && <p className="mt-6 text-sm text-slate-700">{message}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <TransactionBlock
            type="income"
            total={incomeTotal}
            categories={categories}
            month={month}
            onSaved={handleSaved}
            items={incomeItems}
            loading={loading}
            categoryNames={categoryNames}
          />
          <TransactionBlock
            type="expense"
            total={expenseTotal}
            categories={categories}
            month={month}
            onSaved={handleSaved}
            items={expenseItems}
            loading={loading}
            categoryNames={categoryNames}
          />
        </div>

        <p className="mt-8">
          <Link to="/dashboard" className={linkClass}>
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

export default TransactionsPage;