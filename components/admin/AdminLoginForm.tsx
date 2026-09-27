"use client";

import { LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/public/SiteHeader";

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Email немесе құпиясөз қате");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Кіру мүмкін болмады. Қайта көріңіз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <Link href="/" className="admin-login-brand" aria-label="Басты бетке оралу">
          <BrandMark />
        </Link>
        <div className="admin-login-icon" aria-hidden="true">
          <LockKeyhole />
        </div>
        <h1 id="admin-login-title">Әкімшіге кіру</h1>
        <p>Өтінімдер мен тіркелу баптауларын басқару</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="admin-email">Email <span aria-hidden="true">*</span></label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Құпиясөз <span aria-hidden="true">*</span></label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="admin-primary-button" type="submit" disabled={pending}>
            {pending ? <><LoaderCircle className="spin" /> Кіріп жатыр...</> : "Кіру"}
          </button>
        </form>
        <Link className="back-link" href="/">Олимпиадаға тіркелу бетіне оралу</Link>
      </section>
    </main>
  );
}
