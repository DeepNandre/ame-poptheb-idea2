import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { submitDemoRequest } from "./submitDemo";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setStatusErr("Please enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setStatusErr("Please enter a valid work email.");
    setStatus("submitting");
    setError("");
    try {
      await submitDemoRequest({ name: name.trim(), email: email.trim(), company: company.trim() });
      setStatus("success");
    } catch {
      setStatusErr("Something went wrong. Please try again in a moment.");
    }
  }
  function setStatusErr(msg: string) {
    setError(msg);
    setStatus("error");
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
  const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-5" />
        </button>

        {status === "success" ? (
          <div className="py-6 text-center">
            <h2 className="mb-2 text-2xl font-display">Request received.</h2>
            <p className="text-muted-foreground">
              Thanks, {name.split(" ")[0] || "there"} — we'll be in touch to set up your walkthrough.
            </p>
            <button onClick={onClose} className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-display">Book a demo</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Bring one insured address — we'll run the full unified profile live on the call.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="d-name" className={labelClass}>Name</label>
                <input ref={firstRef} id="d-name" type="text" value={name}
                  onChange={(e) => { setName(e.target.value); if (status === "error") setStatus("idle"); }}
                  className={inputClass} placeholder="Your name" required />
              </div>
              <div>
                <label htmlFor="d-email" className={labelClass}>Work email</label>
                <input id="d-email" type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                  className={inputClass} placeholder="you@insurer.com" required />
              </div>
              <div>
                <label htmlFor="d-company" className={labelClass}>
                  Company <span className="normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <input id="d-company" type="text" value={company}
                  onChange={(e) => setCompany(e.target.value)} className={inputClass} placeholder="Where you work" />
              </div>
              {status === "error" && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={status === "submitting"}
                className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {status === "submitting" ? "Sending…" : "Request demo"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">We'll only use your details to arrange the demo.</p>
          </>
        )}
      </div>
    </div>
  );
}
