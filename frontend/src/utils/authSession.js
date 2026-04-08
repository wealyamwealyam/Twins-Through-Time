export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  const keys = Object.keys(window.localStorage);

  for (const key of keys) {
    if (/^sb-.*-auth-token$/.test(key)) {
      window.localStorage.removeItem(key);
    }
  }
}

export async function getSafeSession(supabase, timeoutMs = 2500) {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth request timed out.")), timeoutMs)
      ),
    ]);

    return {
      session: result?.data?.session ?? null,
      recovered: false,
      error: null,
    };
  } catch (error) {
    clearSupabaseAuthStorage();

    return {
      session: null,
      recovered: true,
      error,
    };
  }
}