#!/usr/bin/env python3
"""Generate the German Shepherd — Validation Evidence Pack slide deck (16:9 PDF).

Run: python scripts/build-evidence-deck.py [output.pdf]
Content mirrors the /validate dashboard. Real, sourced figures only.
"""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

# ── 16:9 canvas ──────────────────────────────────────────────────────────────
W, H = 960, 540
ORANGE = (1.0, 0.329, 0.0)        # #ff5400
INK = (0.06, 0.06, 0.06)          # near-black
GRAY = (0.40, 0.40, 0.42)
LGRAY = (0.62, 0.62, 0.64)
LINE = (0.88, 0.88, 0.89)
PANEL = (0.97, 0.97, 0.975)
GREEN = (0.13, 0.6, 0.42)
WHITE = (1, 1, 1)

OUT = sys.argv[1] if len(sys.argv) > 1 else "germanshepherd-evidence-deck.pdf"
c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle("German Shepherd — Validation Evidence Pack")
c.setAuthor("German Shepherd")

MX = 56  # left/right margin


def rgb(t):
    return t


def fill(t):
    c.setFillColorRGB(*t)


def stroke(t):
    c.setStrokeColorRGB(*t)


def _san(s):
    # Map glyphs outside the base-14 WinAnsi set to safe equivalents.
    return (s.replace("→", "->").replace("—", "-").replace("✓", ""))


def text(x, y, s, size=12, font="Helvetica", color=INK, tracking=0):
    s = _san(s)
    fill(color)
    c.setFont(font, size)
    if tracking:
        tobj = c.beginText(x, y)
        tobj.setFont(font, size)
        tobj.setCharSpace(tracking)
        tobj.textOut(s)
        tobj.setCharSpace(0)  # reset so Tc doesn't leak into later text
        c.drawText(tobj)
    else:
        c.drawString(x, y, s)


def rtext(x, y, s, size=12, font="Helvetica", color=INK):
    s = _san(s)
    fill(color)
    c.setFont(font, size)
    c.drawRightString(x, y, s)


def ctext(x, y, s, size=12, font="Helvetica", color=INK):
    s = _san(s)
    fill(color)
    c.setFont(font, size)
    c.drawCentredString(x, y, s)


def para(x, y, s, size=11, font="Helvetica", color=GRAY, width=380, leading=16):
    s = _san(s)
    fill(color)
    c.setFont(font, size)
    lines = simpleSplit(s, font, size, width)
    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y


def kicker(x, y, s):
    text(x, y, s.upper(), 10.5, "Helvetica-Bold", ORANGE, tracking=2.2)


def rrect(x, y, w, h, r=10, fillc=None, strokec=None, lw=1):
    if fillc:
        fill(fillc)
    if strokec:
        stroke(strokec)
        c.setLineWidth(lw)
    c.roundRect(x, y, w, h, r, stroke=1 if strokec else 0, fill=1 if fillc else 0)


def page_bg():
    fill(WHITE)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def footer(n):
    stroke(LINE)
    c.setLineWidth(1)
    c.line(MX, 40, W - MX, 40)
    text(MX, 26, "German Shepherd  ·  Validation Evidence Pack", 8.5, "Helvetica", LGRAY)
    rtext(W - MX, 26, f"{n}", 8.5, "Helvetica", LGRAY)


def header(title, kick):
    kicker(MX, H - 64, kick)
    text(MX, H - 96, title, 30, "Helvetica-Bold", INK)
    stroke(ORANGE)
    c.setLineWidth(3)
    c.line(MX, H - 110, MX + 46, H - 110)


def new(n, title=None, kick=None):
    page_bg()
    if title:
        header(title, kick or "")
    footer(n)


# ── Slide 1 — Title ──────────────────────────────────────────────────────────
page_bg()
fill(INK)
c.rect(0, 0, W, H, fill=1, stroke=0)
# accent
fill(ORANGE)
c.rect(0, 0, 10, H, fill=1, stroke=0)
text(MX, H - 150, "German Shepherd", 56, "Helvetica-Bold", ORANGE)
text(MX, H - 196, "Validation Evidence Pack", 26, "Helvetica", WHITE)
fill((0.7, 0.7, 0.72))
c.setFont("Helvetica", 14)
c.drawString(MX, H - 240, "Track 02 · Validate   —   test a company's story and make the evidence usable")
# tagline
text(MX, 150, "“See your policyholders the way attackers do.”", 18, "Helvetica-Oblique", (0.85, 0.85, 0.87))
para(MX, 116,
     "We show insurers and building operators exactly what attackers already know about a "
     "physical space — from public, passively gathered data alone.",
     12, "Helvetica", (0.6, 0.6, 0.63), width=720, leading=18)
fill(ORANGE)
c.setFont("Helvetica-Bold", 12)
c.drawString(MX, 64, "As of 7 June 2026")
rtext(W - MX, 64, "Every claim is dated, sourced and independently checkable.", 11, "Helvetica", (0.55, 0.55, 0.58))
c.showPage()

# ── Slide 2 — Proof at a glance (KPIs) ───────────────────────────────────────
new(2, "Proof at a glance", "The headline")
kpis = [
    ("£500", "First revenue received", "TMC deposit — Stripe, 3D-Secure, Succeeded"),
    ("£60k", "2 signed LOIs + a paid pilot", "Bolttech £30k · Upahaar £30k · TMC £20k pilot"),
    ("36h", "Field validation sprint", "Real buildings entered, frontline staff interviewed"),
    ("Live", "Working product", "Address → physical risk surface, every finding sourced"),
]
cw = (W - 2 * MX - 3 * 16) / 4
for i, (v, l, s) in enumerate(kpis):
    x = MX + i * (cw + 16)
    rrect(x, 150, cw, 210, 12, fillc=PANEL)
    text(x + 18, 306, v, 32, "Helvetica-Bold", INK)
    ly = para(x + 18, 280, l, 11.5, "Helvetica-Bold", INK, width=cw - 34, leading=14)
    para(x + 18, ly - 2, s, 9.5, "Helvetica", GRAY, width=cw - 34, leading=12.5)
para(MX, 120,
     "Two signed LOIs (£60k), a paying customer already in (TMC deposit, signed LOI to follow), "
     "and more LOIs in motion. This page is the proof, not the pitch.",
     12, "Helvetica", GRAY, width=W - 2 * MX, leading=17)
c.showPage()

# ── Slide 3 — Traction / customers ───────────────────────────────────────────
new(3, "Traction: real customers, two go-to-market paths", "Who's in")
custs = [
    ("Bolttech", "Insurer channel", "£30,000", "Signed LOI + reseller rights into their insurer network. Follow-up endorsement from the signatory.", GREEN, "SIGNED"),
    ("Upahaar", "Direct enterprise · Nashik", "£30,000", "Signed & customer-countersigned LOI (email confirmation on file). Office had repeated break-ins.", GREEN, "SIGNED"),
    ("TMC Solicitors", "Direct enterprise · Manchester", "£20,000", "Paid £500 deposit; signed LOI to follow. Law firm with 2 break-in attempts in the past year.", ORANGE, "PAID PILOT"),
]
cw = (W - 2 * MX - 2 * 16) / 3
for i, (co, seg, val, desc, badge, btxt) in enumerate(custs):
    x = MX + i * (cw + 16)
    rrect(x, 150, cw, 230, 12, strokec=LINE, lw=1.2)
    text(x + 18, 348, co, 19, "Helvetica-Bold", INK)
    text(x + 18, 330, seg, 9.5, "Helvetica", LGRAY)
    text(x + 18, 296, val, 26, "Helvetica-Bold", ORANGE)
    # badge
    fill(badge)
    c.setFont("Helvetica-Bold", 8)
    bw = c.stringWidth(btxt, "Helvetica-Bold", 8) + 14
    rrect(x + 18, 262, bw, 16, 8, fillc=(0.93, 0.97, 0.95) if badge == GREEN else (1.0, 0.93, 0.88))
    fill(badge)
    c.drawString(x + 25, 266, btxt)
    para(x + 18, 240, desc, 10, "Helvetica", GRAY, width=cw - 36, leading=13)
# pipeline strip
rrect(MX, 92, W - 2 * MX, 44, 10, fillc=PANEL)
text(MX + 16, 116, "PIPELINE", 9, "Helvetica-Bold", ORANGE, tracking=1.5)
para(MX + 90, 116,
     "Eric (insurance, introduced by Lyndon) — called last night, interested, meeting this morning to scope a further LOI.",
     11, "Helvetica", GRAY, width=W - 2 * MX - 110, leading=14)
c.showPage()

# ── Slide 4 — First revenue ──────────────────────────────────────────────────
new(4, "First revenue — money in the bank", "Not just intent")
rrect(MX, 150, 420, 250, 14, fillc=INK)
text(MX + 28, 360, "TMC SOLICITORS", 11, "Helvetica-Bold", (0.65, 0.65, 0.68), tracking=1.5)
text(MX + 28, 312, "£500.00", 46, "Helvetica-Bold", ORANGE)
text(MX + 28, 286, "Deposit received — toward the £20,000 pilot", 12, "Helvetica", WHITE)
for i, ln in enumerate([
    "Stripe · Visa credit card · 3D-Secure authenticated",
    "Status: Succeeded  ·  6 Jun 2026, 23:52",
    "Paid by Moeed Chughtai on his father's behalf",
]):
    text(MX + 28, 250 - i * 20, "•  " + ln, 11, "Helvetica", (0.8, 0.8, 0.82))
# right: why it matters
rx = MX + 460
text(rx, 360, "Why this matters", 15, "Helvetica-Bold", INK)
for i, ln in enumerate([
    "A customer has paid real money — the strongest signal of demand.",
    "The pain is concrete: TMC, an immigration/asylum law firm, had two",
    "break-in attempts in the past year and handles confidential files.",
    "Reached via Moeed (AMe cohort); his father is the principal solicitor.",
    "Signed LOI to follow — finalisation meeting scheduled (see pipeline).",
]):
    text(rx, 326 - i * 26, "—  " + ln, 11, "Helvetica", GRAY)
text(rx, 168, "Verify:", 11, "Helvetica-Bold", INK)
para(rx + 44, 168, "open the Stripe receipt — £500.00 GBP, Succeeded, 3D-Secure, charged 6 Jun 23:52.",
     11, "Helvetica", GRAY, width=300, leading=14)
c.showPage()

# ── Slide 5 — LOIs detail (table) ────────────────────────────────────────────
new(5, "The Letters of Intent", "Signed commitments")
cols = [MX, MX + 150, MX + 270, MX + 470, MX + 720]
heads = ["Customer", "Value", "Access", "Status"]
ys = 372
text(cols[0], ys, heads[0], 10, "Helvetica-Bold", LGRAY)
text(cols[1], ys, heads[1], 10, "Helvetica-Bold", LGRAY)
text(cols[2], ys, heads[2], 10, "Helvetica-Bold", LGRAY)
text(cols[3], ys, heads[3], 10, "Helvetica-Bold", LGRAY)
stroke(LINE); c.setLineWidth(1); c.line(MX, ys - 10, W - MX, ys - 10)
rows = [
    ("Bolttech", "Baldev Singh — RGM / Chief Growth Officer", "£30,000",
     "12 months full access + 1 free month", "Signed", GREEN),
    ("Upahaar", "Aditya Kakuste — Founder's Office", "£30,000",
     "12 months full access + 1 free month", "Signed & countersigned", GREEN),
    ("TMC Solicitors", "Muazzam Chughtai — Principal Solicitor", "£20,000",
     "Month 1 free, then 12 months + 1 free month", "Deposit paid · LOI to follow", ORANGE),
]
ry = ys - 38
for co, who, val, acc, st, cl in rows:
    text(cols[0], ry, co, 13, "Helvetica-Bold", INK)
    text(cols[0], ry - 15, who, 9, "Helvetica", LGRAY)
    text(cols[1], ry, val, 13, "Helvetica-Bold", ORANGE)
    para(cols[2], ry + 2, acc, 10, "Helvetica", GRAY, width=185, leading=12)
    text(cols[3], ry, st, 10, "Helvetica-Bold", cl)
    stroke(LINE); c.setLineWidth(0.8); c.line(MX, ry - 30, W - MX, ry - 30)
    ry -= 64
para(MX, 110,
     "All three pilots include live wireless scanning, corporate OSINT, exposed-infrastructure mapping, "
     "planning-record lookup and the building intelligence graph. Full signed PDFs are hosted on the "
     "/validate dashboard for judges to open.",
     11, "Helvetica", GRAY, width=W - 2 * MX, leading=15)
c.showPage()

# ── Slide 6 — Endorsement ────────────────────────────────────────────────────
new(6, "The decision-maker is championing it", "Customer endorsement")
rrect(MX, 150, W - 2 * MX, 250, 14, fillc=PANEL)
fill(ORANGE); c.rect(MX, 150, 5, 250, fill=1, stroke=0)
quote = ("“Very pleased to see the developing idea… both the customer and the insurance industry "
         "benefit from reduced losses through early prevention… I would be happy to take this further "
         "with the industry to socialize it and gain interest. Initiatives such as these are certainly at "
         "the forefront of new tech development powered by AI.”")
para(MX + 34, 360, quote, 16, "Helvetica-Oblique", INK, width=W - 2 * MX - 70, leading=26)
text(MX + 34, 186, "— Baldev Singh, Bolttech (follow-up email, with the signed LOI attached · 7 Jun 2026)",
     11, "Helvetica-Bold", GRAY)
para(MX, 110,
     "This moves Bolttech from “signed document” to “signed document + decision-maker actively "
     "championing it with the wider industry.”",
     11, "Helvetica", GRAY, width=W - 2 * MX, leading=15)
c.showPage()

# ── Slide 7 — Field research ─────────────────────────────────────────────────
new(7, "Field research: consent-based frontline interviews", "Demand, validated in person")
ivs = [
    ("Shahab", "Restaurant / building staff", "Cameras, sensors, control-room alerts, radio checks — the gap is ambiguous human incidents, not locked doors."),
    ("Security officer · ex-Peninsula 5★", "Commercial building", "An intruder wore an NHS lanyard to pass as a contractor, walked in and stole a bike from the basement."),
    ("Security officer · residential", "High-rise, London", "Intruders reached a neighbouring roof via a crane (police chase). Lone-worker cover is the weak point."),
    ("Aziz", "Reception", "Declined recording — captured honestly as a research-process lesson."),
]
cw = (W - 2 * MX - 16) / 2
for i, (nm, role, desc) in enumerate(ivs):
    col = i % 2
    row = i // 2
    x = MX + col * (cw + 16)
    y = 300 - row * 110
    rrect(x, y, cw, 96, 10, strokec=LINE, lw=1)
    text(x + 16, y + 70, nm, 12.5, "Helvetica-Bold", INK)
    text(x + 16, y + 55, role, 9, "Helvetica", LGRAY)
    para(x + 16, y + 38, desc, 9.5, "Helvetica", GRAY, width=cw - 32, leading=12)
# insight
rrect(MX, 64, W - 2 * MX, 28, 8, fillc=(1.0, 0.96, 0.93))
para(MX + 14, 82,
     "What we learned: sites already have the hardware — the real gap is ambiguous human moments "
     "(tailgating, impersonation, who-belongs). That's the physical risk insurers underwrite, and what "
     "German Shepherd surfaces from the outside.",
     9.5, "Helvetica", (0.5, 0.32, 0.1), width=W - 2 * MX - 28, leading=12)
c.showPage()

# ── Slide 8 — Product capabilities ───────────────────────────────────────────
new(8, "The product is real and runs", "Verified live at /app")
feats = [
    ("Natural-language command bar", "Ask anything; an LLM drives the map and panels."),
    ("3D map + planning-record lookup", "Live council registers; public drawings classified."),
    ("Corporate OSINT recon", "Exposed infra, subdomains, tech stack — with provenance."),
    ("Live WiFi heatmap", "Real device signals by RSSI → distance (honest estimate)."),
    ("Live Bluetooth (BLE) heatmap", "Nearby BLE devices as a distinct heat layer."),
    ("CCTV discovery + live feed", "Finds cameras on-network; RTSP → MJPEG stream."),
    ("Crime + designation overlays", "police.uk crime; conservation/listed/Article 4/TPO."),
    ("Intelligence graph + report", "One graph, exportable as a sourced evidence report."),
]
cw = (W - 2 * MX - 16) / 2
for i, (t, d) in enumerate(feats):
    col = i % 2
    row = i // 2
    x = MX + col * (cw + 16)
    y = 322 - row * 56
    fill(ORANGE); c.circle(x + 8, y + 6, 3, fill=1, stroke=0)
    text(x + 22, y + 8, t, 12, "Helvetica-Bold", INK)
    text(x + 22, y - 6, d, 9.5, "Helvetica", GRAY)
para(MX, 70,
     "Real-data-only: missing keys return an honest empty state, never mock data. The hosted build shows "
     "the full UI and public-data flows; live radio/CCTV/OSINT scanning runs against the local backend.",
     9.5, "Helvetica", LGRAY, width=W - 2 * MX, leading=12)
c.showPage()

# ── Slide 9 — Significance ───────────────────────────────────────────────────
new(9, "Why the truth matters", "Significance")
text(MX, 360, "We insure the insurer.", 20, "Helvetica-BoldOblique", ORANGE)
para(MX, 332,
     "We show insurers what attackers already know about their policyholders, so clients are more secure "
     "and insurers pay out less.",
     13, "Helvetica", INK, width=W - 2 * MX, leading=18)
pts = [
    "Building-level physical risk (passive signals + OSINT + the planning record) is a dimension existing underwriting data does not cover.",
    "Three customers across two go-to-market paths — insurer channel (Bolttech) and direct enterprise (Upahaar, TMC) — with first cash already received.",
    "Bolttech offers a distribution channel into a whole insurer network (device, property, SME risk), not a single team.",
    "Acute, repeatable pain: two of three customers had real break-ins. The value is tangible, not theoretical.",
]
y = 286
for p in pts:
    fill(ORANGE); c.rect(MX, y - 2, 16, 2.5, fill=1, stroke=0)
    y = para(MX + 26, y, p, 11.5, "Helvetica", GRAY, width=W - 2 * MX - 26, leading=15) - 8
c.showPage()

# ── Slide 10 — Upcoming meetings ─────────────────────────────────────────────
new(10, "Upcoming meetings — live pipeline", "This morning")
mtgs = [
    ("TMC Solicitors · Muazzam Chughtai", "Get the signed LOI sorted",
     "Deposit already paid (£500). Meeting to officially sort and countersign the £20k pilot LOI."),
    ("Eric · insurance", "Scope a further LOI",
     "Introduced by Lyndon; works in insurance. Called last night — interested, asked us to call back this morning."),
]
cw = (W - 2 * MX - 16) / 2
for i, (who, what, d) in enumerate(mtgs):
    x = MX + i * (cw + 16)
    rrect(x, 170, cw, 200, 12, strokec=LINE, lw=1.2)
    rrect(x + 18, 326, 132, 20, 10, fillc=PANEL)
    fill(ORANGE); c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 28, 331, "THIS MORNING · 7 JUN")
    text(x + 18, 296, what, 15, "Helvetica-Bold", INK)
    text(x + 18, 278, who, 10.5, "Helvetica-Bold", GRAY)
    para(x + 18, 256, d, 10.5, "Helvetica", GRAY, width=cw - 36, leading=14)
para(MX, 120, "Forward-looking pipeline, shown for transparency — not counted as closed proof.",
     10, "Helvetica", LGRAY, width=W - 2 * MX, leading=13)
c.showPage()

# ── Slide 11 — How to verify ─────────────────────────────────────────────────
new(11, "How a judge verifies all of this", "Rigour & honesty")
steps = [
    "Open the live evidence dashboard at /validate — every claim links to a dated, checkable source.",
    "Open the signed LOI PDFs (Bolttech, Upahaar) and the TMC LOI document + Stripe receipt.",
    "Run a live scan at /app — confirm sourced findings, real-data-only (no mock).",
    "Read the field-research interviews and watch the on-site footage.",
    "Anything not yet third-party-verifiable is flagged “Our log” / “Pending”; nothing is fabricated.",
]
y = 330
for i, s in enumerate(steps):
    text(MX, y, f"{i+1:02d}", 13, "Helvetica-Bold", ORANGE)
    para(MX + 34, y, s, 12, "Helvetica", INK, width=W - 2 * MX - 40, leading=16)
    y -= 44
rrect(MX, 96, W - 2 * MX, 40, 10, fillc=INK)
fill(WHITE); c.setFont("Helvetica-Bold", 11)
c.drawString(MX + 18, 120, "Evidence pack:")
fill((0.85, 0.85, 0.87)); c.setFont("Helvetica", 11)
c.drawString(MX + 120, 120, "spectre-peach.vercel.app/validate")
fill((0.6, 0.6, 0.63)); c.setFont("Helvetica", 9.5)
c.drawString(MX + 18, 104, "Hosted PDFs: Bolttech LOI · Upahaar signed LOI + email · TMC LOI · Stripe receipt · field footage")
c.showPage()

c.save()
print("Wrote", OUT)
