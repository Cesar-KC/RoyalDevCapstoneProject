import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/me");
        if (response.status === 200) {
          setUser(await response.json());
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    }
    loadUser();
  }, [navigate]);

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  if (user === null) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={handleLogout}>Log out</button>
      <nav>
        <Link to="/budget">Budget</Link> · <Link to="/transactions">Transactions</Link>
      </nav>
    </div>
  );
}

export default DashboardPage;