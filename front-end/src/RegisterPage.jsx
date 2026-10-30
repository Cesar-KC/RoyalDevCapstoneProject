import { useState } from "react";
import { Link } from "react-router";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "text-sm font-semibold text-slate-700";

function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (response.status === 201) {
        setMessage(`Account created! Welcome, ${data.name}.`);
      } else if (response.status === 409) {
        setMessage(data.detail);
      } else if (response.status === 422) {
        if (typeof data.detail === "string") {
          setMessage(data.detail);
        } else {
          const first = data.detail[0];
          setMessage(`${first.loc[1]}: ${first.msg}`);
        }
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setMessage("Could not reach the server. Is the backend running?");
    }
  }


    return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/60">
        <h1 className="text-4xl font-medium tracking-tight text-[#1b2559]">Register</h1>

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Username</label>
            <input name="username" value={form.username} onChange={handleChange} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Name</label>
            <input name="name" value={form.name} onChange={handleChange} className={inputClass} />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <label className={labelClass}>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Confirm password</label>
            <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} className={inputClass} />
          </div>
          <button
            type="submit"
            className="col-span-2 mt-2 w-full rounded-xl bg-[#3563e3] py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2b54cc]"
          >
            Sign up
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-slate-700">{message}</p>}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#3563e3] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
  
}

export default RegisterPage;