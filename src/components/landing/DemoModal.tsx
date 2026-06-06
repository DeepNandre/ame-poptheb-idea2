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
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      setStatus("error");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid work email.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await submitDemoRequest({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
      });
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again in a moment.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 transition-colors focus:border-sky-400/50 focus:outline-none";
  const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-gray-400";

  return (
    <div
      className="font-inter fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-title"
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="liquid-glass relative z-10 w-full max-w-md rounded-2xl border border-white/20 p-8 text-white">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white"
        >
          <X size={20} />
        </button>

        {status === "success" ? (
          <div className="py-6 text-center">
            <h2 className="mb-2 text-2xl font-medium">Request received.</h2>
            <p className="text-gray-300">
              Thanks, {name.split(" ")[0] || "there"} &mdash; we&rsquo;ll be in touch shortly to
              set up your Spectre walkthrough.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-white px-6 py-2.5 font-medium text-black transition-colors hover:bg-gray-100"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id="demo-title" className="mb-1 text-2xl font-medium">
              Book a demo
            </h2>
            <p className="mb-6 text-sm text-gray-300">
              Tell us where to reach you and we&rsquo;ll show you the exposure picture Spectre
              builds for an address you care about.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="demo-name" className={labelClass}>
                  Name
                </label>
                <input
                  ref={firstFieldRef}
                  id="demo-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  className={inputClass}
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label htmlFor="demo-email" className={labelClass}>
                  Work email
                </label>
                <input
                  id="demo-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  className={inputClass}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="demo-company" className={labelClass}>
                  Company <span className="normal-case text-gray-500">(optional)</span>
                </label>
                <input
                  id="demo-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputClass}
                  placeholder="Where you work"
                />
              </div>

              {status === "error" && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Sending…" : "Request demo"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              We&rsquo;ll only use your details to arrange your demo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
