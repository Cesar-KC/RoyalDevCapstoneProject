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
    <div>
      <h1>Budget App</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username</label>
          <input name="username" value={form.username} onChange={handleChange} required />
        </div>
        <div>
          <label>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required />
        </div>
        <button type="submit">Login</button>
      </form>
      {message && <p>{message}</p>} 
      <p>
        Don't have an account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  );
}

export default LoginPage;