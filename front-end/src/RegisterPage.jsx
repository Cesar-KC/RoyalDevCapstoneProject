import { useState } from "react";
import { Link } from "react-router";

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
    <div>
      <h1>Register</h1>
      <p>Preview: {form.username} ({form.name})</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username</label>
          <input name="username" value={form.username} onChange={handleChange} />
        </div>
        <div>
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} />
        </div>
        <div>
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <label>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} />
        </div>
        <div>
          <label>Confirm password</label>
          <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} />
        </div>
        <button type="submit">Sign up</button>
      </form>
      {message && <p>{message}</p>}
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default RegisterPage;