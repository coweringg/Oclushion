"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiLogin } from "./api-client";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  plan: string;
};

type AuthState = {
  token: string;
  user: AdminUser;
};

type AuthContextType = {
  token: string | null;
  user: AdminUser | null;
  organizationId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
};

const SESSION_KEY = "oclushion_admin_session";

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  organizationId: null,
  login: async () => {},
  logout: () => {},
  isLoading: true,
});

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { token: string; user: AdminUser };
        if (parsed.token && parsed.user) {
          setState(parsed);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    const user: AdminUser = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      organizationId: (result.user as Record<string, unknown>).organizationId as string,
      plan: (result.user as Record<string, unknown>).plan as string ?? "Free",
    };
    const session = { token: result.token, user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setState(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: state?.token ?? null,
        user: state?.user ?? null,
        organizationId: state?.user.organizationId ?? null,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth(): AuthContextType {
  return useContext(AuthContext);
}
