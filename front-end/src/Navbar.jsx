import { NavLink, useNavigate } from "react-router";

// Same navy as the page headings
const NAVY = "text-[#1b2559]";

// Top bar shared by the logged-in pages: app name on the left, pill navigation on the right
function Navbar() {
  const navigate = useNavigate();

  // NavLink tells us if its link is the current page, so the active pill can be highlighted
  const pillClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive ? "bg-blue-50 text-[#3563e3]" : "text-slate-600 hover:text-slate-900"
    }`;

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <span className={`text-lg font-semibold uppercase tracking-[0.25em] ${NAVY}`}>Royal Budget</span>
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
        <NavLink to="/profile" className={pillClass}>
          Profile
        </NavLink>
        <button
          onClick={handleLogout}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}

export default Navbar;
