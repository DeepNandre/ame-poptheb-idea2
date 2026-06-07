import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Cctv,
  Crosshair,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  answerReconQuestion,
  osintFromScan,
  peopleFromRecon,
  type OsintFinding,
  type Person,
} from "./reconWorkspaceData";
import type { ReconPerson } from "./useReconPipeline";
import type { ScanResult } from "./reconApi";

type Tab = "chat" | "people" | "osint";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

/**
 * Left-docked workspace that opens once the recon pipeline completes. Three
 * panes — a ChatGPT-style assistant that answers questions about the building,
 * a People roster with per-person enrichment, and an OSINT findings list — plus
 * a 3D View button that hands off to the schematic viewer.
 *
 * Prefers the ACTUAL scraped intel from the recon pipeline (Companies House +
 * Apollo people, VPN-scanner OSINT). Falls back to seeded mock intel only for a
 * section the pipeline returned nothing for (skipped phase / no data), so the
 * panel is never empty during a demo.
 */
export function ReconWorkspace({
  building,
  realPeople,
  realOsint,
  onOpen3D,
  onClose,
}: {
  building: string;
  realPeople?: ReconPerson[];
  realOsint?: ScanResult | null;
  onOpen3D: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("chat");
  const people = useMemo(
    () => (realPeople && realPeople.length ? peopleFromRecon(realPeople) : []),
    [realPeople],
  );
  const osint = useMemo(() => (realOsint ? osintFromScan(realOsint) : []), [realOsint]);
  const domain = realOsint?.resolved_domain || undefined;

  return (
    <div className="glass flex max-h-full min-h-0 w-[min(26rem,calc(100vw-2rem))] flex-col rounded-2xl text-white animate-fade-in">
      {/* header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-cyan-400 text-black">
              <Crosshair className="size-3.5" />
            </span>
            <span className="truncate text-[14px] font-semibold tracking-tight">{building}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300">
            <Sparkles className="size-3" />
            Recon complete · {people.length} people · {osint.length} findings
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close workspace"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-2">
        <TabButton icon={MessageSquare} label="Chat" active={tab === "chat"} onClick={() => setTab("chat")} />
        <TabButton icon={Users} label="People" active={tab === "people"} onClick={() => setTab("people")} count={people.length} />
        <TabButton icon={Cctv} label="OSINT" active={tab === "osint"} onClick={() => setTab("osint")} count={osint.length} />
        <button
          onClick={onOpen3D}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-[12px] font-medium text-sky-100 transition-colors hover:bg-sky-500/30"
        >
          <Boxes className="size-3.5" /> 3D View
        </button>
      </div>

      {/* body */}
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {tab === "chat" && <ChatPane building={building} people={people} domain={domain} />}
        {tab === "people" && <PeoplePane people={people} />}
        {tab === "osint" && <OsintPane findings={osint} />}
      </div>
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  count,
}: {
  icon: typeof Users;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white/80",
      )}
    >
      <Icon className="size-3.5" />
      {label}
      {count != null && (
        <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-white/10 text-white/45")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ---- Chat ------------------------------------------------------------------

function ChatPane({ building, people, domain }: { building: string; people: Person[]; domain?: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: `Recon on ${building} is in. I've ingested the schematic, people, and OSINT findings. Ask me about entrances, the people roster, the 3D layout, cameras, network exposure, or where the weak points are.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const send = () => {
    const q = input.trim();
    if (!q || thinking) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    timer.current = setTimeout(() => {
      setMsgs((m) => [...m, { role: "assistant", text: answerReconQuestion(building, q, people, domain) }]);
      setThinking(false);
    }, 650 + Math.random() * 500);
  };

  const suggestions = ["How do I get in?", "Who works here?", "Where are the weak points?", "Camera coverage?"];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="scroll-quiet min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md",
                m.role === "assistant" ? "bg-cyan-400 text-black" : "bg-white/15 text-white/80",
              )}
            >
              {m.role === "assistant" ? <Crosshair className="size-3" /> : <span className="text-[10px] font-bold">You</span>}
            </span>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed",
                m.role === "assistant"
                  ? "rounded-tl-sm bg-white/[0.06] text-white/85"
                  : "rounded-tr-sm bg-cyan-400/20 text-cyan-50",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-cyan-400 text-black">
              <Crosshair className="size-3" />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2.5">
              <span className="size-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-white/50" />
            </div>
          </div>
        )}
      </div>

      {/* suggestion chips (only before the user has asked anything) */}
      {msgs.length === 1 && !thinking && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/85"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <div className="shrink-0 border-t border-white/10 p-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-cyan-300/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Ask about ${building}…`}
            className="max-h-24 min-h-[1.25rem] flex-1 resize-none bg-transparent text-[12.5px] text-white/90 outline-none placeholder:text-white/35"
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking}
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-cyan-400 text-black transition-colors hover:bg-cyan-300 disabled:opacity-30"
          >
            {thinking ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- People ----------------------------------------------------------------

const SENIORITY_STYLE: Record<Person["seniority"], string> = {
  exec: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  senior: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  staff: "border-white/15 bg-white/[0.04] text-white/55",
  contractor: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

function PeoplePane({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const [enriched, setEnriched] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Users className="size-6 text-white/25" />
        <div className="text-[12px] text-white/40">No people found for this building.</div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? people.filter((p) => `${p.name} ${p.role} ${p.dept}`.toLowerCase().includes(q))
    : people;

  const enrich = (id: string) => {
    if (enriched.has(id) || loadingId) return;
    setLoadingId(id);
    timer.current = setTimeout(() => {
      setEnriched((s) => new Set(s).add(id));
      setLoadingId(null);
    }, 750);
  };

  return (
    <div className="p-3">
      <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <Search className="size-3.5 text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, role, department…"
          className="flex-1 bg-transparent text-[12px] text-white/90 outline-none placeholder:text-white/35"
        />
      </div>

      <div className="space-y-1.5">
        {shown.map((p) => {
          const isEnriched = enriched.has(p.id);
          return (
            <div key={p.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
                  {p.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-white/90">{p.name}</div>
                  <div className="truncate text-[11px] text-white/50">{p.role}</div>
                </div>
                <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide", SENIORITY_STYLE[p.seniority])}>
                  {p.dept}
                </span>
              </div>

              {isEnriched ? (
                <div className="mt-2 grid gap-1 border-t border-white/[0.06] pt-2 text-[11px] text-white/65">
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:text-cyan-200">
                      <Mail className="size-3 text-white/40" /> {p.email}
                      {p.emailVerified && <span className="text-[9px] text-emerald-300">✓ verified</span>}
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-white/35">
                      <Mail className="size-3 text-white/40" /> no email found
                    </span>
                  )}
                  {p.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3 text-white/40" /> {p.phone}
                    </span>
                  )}
                  {(p.location || p.tenure) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-white/40" />
                      {[p.location, p.tenure && `${p.tenure} tenure`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {p.company && (
                    <span className="flex items-center gap-1.5 text-white/55">
                      <Boxes className="size-3 text-white/40" /> {p.company}
                      {p.appointed && <span className="text-white/35">· appt. {p.appointed}</span>}
                    </span>
                  )}
                  {p.linkedin && (
                    <a
                      href={`https://${p.linkedin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-white/45 hover:text-cyan-200"
                    >
                      {p.linkedin}
                    </a>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => enrich(p.id)}
                  disabled={loadingId === p.id}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingId === p.id ? (
                    <><Loader2 className="size-3 animate-spin" /> Enriching…</>
                  ) : (
                    <><Sparkles className="size-3 text-cyan-300" /> Enrich</>
                  )}
                </button>
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="py-8 text-center text-[12px] text-white/40">No one matches “{query}”.</div>
        )}
      </div>
    </div>
  );
}

// ---- OSINT -----------------------------------------------------------------

const TAG_STYLE: Record<OsintFinding["tag"], string> = {
  domain: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  service: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  access: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  social: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  device: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

function OsintPane({ findings }: { findings: OsintFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Cctv className="size-6 text-white/25" />
        <div className="text-[12px] text-white/40">No OSINT available for this building.</div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 p-3">
      {findings.map((f, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
          <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wide", TAG_STYLE[f.tag])}>
            {f.tag}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[12px] text-white/85">{f.value}</div>
            <div className="text-[10px] text-white/40">{f.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
