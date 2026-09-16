import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="topbar-brand">Huddle</span>
        {user && (
          <div className="topbar-user">
            <span>{user.email}</span>
            <button className="link-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
