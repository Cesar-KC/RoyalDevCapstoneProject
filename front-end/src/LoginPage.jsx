import { useState } from "react";
import { Link, useNavigate } from "react-router";

function LoginPage() {
  const navigate = useNavigate(); 
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (response.status === 200) {
        navigate("/dashboard");
      } else if (response.status === 401) {
        setMessage(data.detail);
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setMessage("Could not reach the server. Is the backend running?");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/60">
        <h1 className="text-4xl font-medium tracking-tight text-[#1b2559]">Budget App</h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Username</label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-[#3563e3] py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2b54cc]"
          >
            Login
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

        <p className="mt-6 text-sm text-slate-500">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-[#3563e3] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );

}

export default LoginPage;