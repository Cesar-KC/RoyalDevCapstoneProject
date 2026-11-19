import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "./Navbar";

// Shared looks (same values as the dashboard and budget pages)
const NAVY = "text-[#1b2559]";
const cardClass = "rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60";
const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "text-sm font-semibold text-slate-700";

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

// "2026-10-29T14:03:00" -> "October 29, 2026"
function joinedLabel(createdAt) {
  return new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// One label / value line in the Profile card
function InfoRow({ label, value }) {
  return (
    <li className="flex flex-wrap justify-between gap-2 py-3">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${NAVY}`}>{value}</span>
    </li>
  );
}

function ProfilePage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  // { type: "error" | "success", text }
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/me");
        if (response.status !== 200) {
          navigate("/login", { replace: true });
          return;
        }
        setUser(await response.json());
      } catch {
        setLoadMessage("Could not reach the server. Is the backend running?");
      }
    }
    loadUser();
  }, [navigate]);

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswords({ ...passwords, [name]: value });
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage(null);

    if (passwords.newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwords.currentPassword,
          new_password: passwords.newPassword,
        }),
      });

      if (response.status === 204) {
        setPasswords(EMPTY_PASSWORDS);
        setPasswordMessage({
          type: "success",
          text: "Password updated. Any other devices have been logged out.",
        });
      } else if (response.status === 401) {
        navigate("/login", { replace: true });
      } else if (response.status === 400) {
        const data = await response.json();
        setPasswordMessage({ type: "error", text: data.detail });
      } else if (response.status === 422) {
        setPasswordMessage({ type: "error", text: "Passwords must be 8 to 72 characters." });
      } else {
        setPasswordMessage({ type: "error", text: "Something went wrong. Please try again." });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Could not reach the server. Is the backend running?" });
    } finally {
      setSaving(false);
    }
  }

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        {loadMessage || "Loading..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-12 pt-8">
        <h1 className={`text-5xl font-medium tracking-tight ${NAVY}`}>Profile & Settings</h1>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <section className={cardClass}>
            <h2 className={`text-xl ${NAVY}`}>Profile</h2>
            <ul className="mt-6 divide-y divide-slate-100">
              <InfoRow label="Name" value={user.name} />
              <InfoRow label="Username" value={user.username} />
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Member since" value={joinedLabel(user.created_at)} />
            </ul>
          </section>

          <section className={cardClass}>
            <h2 className={`text-xl ${NAVY}`}>Settings</h2>

            <form onSubmit={handlePasswordSubmit} className="mt-6 flex flex-col gap-4">
              <h3 className={`font-semibold ${NAVY}`}>Change password</h3>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Current password</span>
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>New password</span>
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    value={passwords.newPassword}
                    onChange={handlePasswordChange}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Confirm new password</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={passwords.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    className={inputClass}
                  />
                </label>
              </div>

              {passwordMessage && (
                <p
                  className={`rounded-xl px-4 py-3 text-sm ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {passwordMessage.text}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[#3563e3] py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2b54cc] disabled:opacity-60"
              >
                {saving ? "Updating..." : "Update password"}
              </button>
            </form>

            {/* Dark mode is planned; the switch is shown but disabled until it's built */}
            <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
              <div>
                <p className={`font-semibold ${NAVY}`}>Dark mode</p>
                <p className="text-sm text-slate-500">Coming soon</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="false"
                aria-label="Dark mode"
                disabled
                className="relative h-7 w-12 cursor-not-allowed rounded-full bg-slate-200"
              >
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
