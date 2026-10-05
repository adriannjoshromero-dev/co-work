import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true"><span>✦</span></div>
        <p className="eyebrow">WELCOME TO HANDOFF</p>
        <h1>Interviews, neatly passed along.</h1>
        <p className="login-intro">A tiny shared workspace for planning well and showing up ready.</p>
        <LoginForm />
        <div className="login-note" aria-hidden="true">
          <span>☕</span><span>Private workspace · just your team</span>
        </div>
      </section>
      <div className="login-doodle doodle-one">✿</div>
      <div className="login-doodle doodle-two">⌁</div>
    </main>
  );
}
