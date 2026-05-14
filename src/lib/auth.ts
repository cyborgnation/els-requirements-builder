import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "els-auth";

export async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (token !== process.env.APP_PASSWORD) {
    redirect("/login");
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token === process.env.APP_PASSWORD;
}

export async function setAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, process.env.APP_PASSWORD!, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}
