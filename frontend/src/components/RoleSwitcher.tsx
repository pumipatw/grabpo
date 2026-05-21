import { useAccount } from "../context/AccountContext";
import { DEMO_ACCOUNTS, type Role } from "../lib/accounts";

export default function RoleSwitcher() {
  const { role, setRole, address } = useAccount();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div className="role-switcher">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.role}
            className={`role-btn ${acc.role} ${role === acc.role ? "active" : ""}`}
            onClick={() => setRole(acc.role as Role)}
          >
            {acc.label}
          </button>
        ))}
      </div>
      <span className="navbar-address">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
    </div>
  );
}
