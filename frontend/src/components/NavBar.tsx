import { NavLink } from "react-router-dom";
import RoleSwitcher from "./RoleSwitcher";
import { useAccount } from "../context/AccountContext";

export default function NavBar() {
  const { isAdmin, isCustomer } = useAccount();

  return (
    <nav className="navbar">
      <span className="navbar-brand">Grabpo</span>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Orderbook
        </NavLink>
        <NavLink to="/rider" className={({ isActive }) => (isActive ? "active" : "")}>
          {isCustomer ? "My Ride" : "Rider"}
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            Admin
          </NavLink>
        )}
      </div>
      <div className="navbar-spacer" />
      <RoleSwitcher />
    </nav>
  );
}
