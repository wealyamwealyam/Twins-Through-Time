/**
 * useAuth.js
 * ----------
 * Global authentication context.
 *
 * Provides:
 *   user       – the logged-in user object, or null
 *   loading    – true while the initial session check is in flight
 *   login()    – { email, password } → stores tokens, sets user
 *   register() – registration data → stores tokens, sets user
 *   logout()   – clears tokens and user
 *
 * Usage:
 *   // Wrap your app:
 *   <AuthProvider> ... </AuthProvider>
 *
 *   // In any component:
 *   const { user, login, logout } = useAuth();
 */

import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getMe }              from "../services/accountService.js";
import { login  as apiLogin,
         logout as apiLogout,
         register as apiRegister } from "../services/authService.js";
import { getToken, clearTokens }   from "../services/api.js";

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token already exists in localStorage, fetch the profile
  // so the user stays logged in after a page refresh.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        // Token was invalid or expired beyond refresh — clear it
        clearTokens();
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function login(credentials) {
    const data = await apiLogin(credentials);
    setUser(data.user);
    return data;
  }

  async function register(registrationData) {
    const data = await apiRegister(registrationData);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAuth() – consume the auth context from any component.
 * Must be used inside <AuthProvider>.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
