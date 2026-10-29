// Shared budget calculations: used by the budget page now, the dashboard later.
// Plan = allocations (expected). Actual = transactions (real).

// Money math in JavaScript floats can drift (52.37 + 42.49 = 94.86000000000001),
// so every total is rounded to cents.
export function roundCents(value) {
  return Math.round(value * 100) / 100;
}

function sum(values) {
  return roundCents(values.reduce((total, value) => total + value, 0));
}

// One row per need/want category: planned (allocation), spent (expenses), left.
// Expenses whose category was deleted (category_id = null) get an "Uncategorized" row.
export function buildCategoryRows(categories, allocations, transactions) {
  const plannedById = new Map(allocations.map((a) => [a.category_id, a.amount]));
  const spentById = new Map();
  for (const t of transactions) {
    if (t.transaction_type === "expense") {
      spentById.set(t.category_id, (spentById.get(t.category_id) ?? 0) + t.amount);
    }
  }

  const rows = categories.map((category) => {
    const planned = plannedById.get(category.id) ?? 0;
    const spent = roundCents(spentById.get(category.id) ?? 0);
    return {
      id: category.id,
      name: category.name,
      kind: category.kind,
      planned,
      spent,
      left: roundCents(planned - spent),
    };
  });

  const uncategorized = roundCents(spentById.get(null) ?? 0);
  if (uncategorized > 0) {
    rows.push({
      id: "uncategorized",
      name: "Uncategorized",
      kind: null,
      planned: 0,
      spent: uncategorized,
      left: -uncategorized,
    });
  }
  return rows;
}

// Totals for one group: "need" or "want"
export function groupTotals(rows, kind) {
  const groupRows = rows.filter((row) => row.kind === kind);
  const planned = sum(groupRows.map((row) => row.planned));
  const spent = sum(groupRows.map((row) => row.spent));
  return { planned, spent, left: roundCents(planned - spent) };
}

// Month-level numbers: income, spending, and projected savings
export function monthSummary(expectedIncome, rows, transactions) {
  const received = sum(
    transactions.filter((t) => t.transaction_type === "income").map((t) => t.amount)
  );
  const plannedSpending = sum(rows.map((row) => row.planned));
  const spent = sum(rows.map((row) => row.spent));

  // The rest of the month goes to plan: each category costs its plan, or more if already over
  const projectedSpending = sum(rows.map((row) => Math.max(row.planned, row.spent)));

  return {
    received,
    plannedSpending,
    spent,
    plannedSavings: roundCents(expectedIncome - plannedSpending),
    // Assumes any missing income still arrives
    projectedSavings: roundCents(Math.max(received, expectedIncome) - projectedSpending),
    unplannedIncome: roundCents(Math.max(0, received - expectedIncome)),
    overspending: roundCents(projectedSpending - plannedSpending),
    missingIncome: roundCents(Math.max(0, expectedIncome - received)),
    // If the missing income never arrives
    worstCaseSavings: roundCents(received - projectedSpending),
  };
}