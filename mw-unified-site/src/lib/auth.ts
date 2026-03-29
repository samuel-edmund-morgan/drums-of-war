export interface AuthSession {
  authenticated: boolean;
  identity_uuid?: string;
  username?: string;
  accounts?: Record<string, number>;
  gmlevel?: number;
}

export async function getSession(): Promise<AuthSession> {
  try {
    const res = await fetch("/auth/session", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}

export async function login(username: string, password: string) {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function logout() {
  const res = await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  return res.json();
}
