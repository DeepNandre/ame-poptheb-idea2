import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";

interface EarlyAccessModalProps {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EarlyAccessModal({ open, onClose }: EarlyAccessModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  // ESC to close, lock body scroll, focus the email field on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => emailRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again in a moment.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 transition-colors focus:border-white/40 focus:outline-none";

  return (
    <div
      className="font-inter fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ea-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
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
            <h2 className="mb-2 text-2xl font-medium">You&rsquo;re on the list.</h2>
            <p className="text-gray-300">
              Thanks for your interest — we&rsquo;ll reach out the moment early access opens.
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
            <h2 id="ea-title" className="mb-1 text-2xl font-medium">
              Request early access
            </h2>
            <p className="mb-6 text-sm text-gray-300">
              Be first through the door. Leave your details and we&rsquo;ll be in touch.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="ea-name"
                  className="mb-1.5 block text-xs uppercase tracking-wide text-gray-400"
                >
                  Name <span className="normal-case text-gray-500">(optional)</span>
                </label>
                <input
                  id="ea-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label
                  htmlFor="ea-email"
                  className="mb-1.5 block text-xs uppercase tracking-wide text-gray-400"
                >
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="ea-email"
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

              {status === "error" && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting…" : "Request access"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              We&rsquo;ll only use your email to contact you about early access.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
