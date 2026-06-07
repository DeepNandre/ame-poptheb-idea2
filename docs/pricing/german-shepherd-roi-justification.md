# German Shepherd — £20,000 Pilot: ROI & Pricing Justification

**Prepared for:** the Bolttech LOI (Ref GS-LOI-2026-001, £20,000, 12-month pilot + reseller rights)
**Question answered:** *Is £20,000 the right price, and how do we prove it saves the insurer far more than it costs?*
**One-line answer:** £20,000 is at or **below the floor** of the comparable market, and on any conservative model it pays for itself by improving claims outcomes on **fewer than 1% of a 1,000-policy SME book** — or by influencing the selection/remediation of **a single avoided claim**.

> FX used throughout: **£1 ≈ $1.27** (June 2026). Every figure is tagged **[INDEPENDENT]** (government / regulator / academic / cross-carrier) or **[VENDOR]** (published by a company selling a related product). Vendor figures are directionally useful but self-selected; lead with independent ones in any investor- or buyer-facing setting.

---

## 1. What German Shepherd actually changes for an insurer

German Shepherd turns a policyholder address into a **pre-bind, outside-in risk surface** (exposed infrastructure via Shodan/Censys, open CCTV/RTSP, corporate OSINT, wireless exposure, the planning record). For an insurer like Bolttech that means three distinct money levers:

1. **Better risk selection** — decline / re-price the worst risks *before* binding (avoid adverse selection).
2. **Loss prevention via remediation prompts** — tell the policyholder what attackers already see, get it fixed, and the claim never happens (the "active insurance" model).
3. **Distribution / resale margin** — package the signal to Bolttech's 230+ insurer network (a revenue line, not just a cost saving).

The rest of this document quantifies levers 1–2 and benchmarks the price.

---

## 2. The exposed-infrastructure thesis is independently corroborated

This is the strongest part of the case: **what German Shepherd detects maps directly to the largest and fastest-growing real-world breach causes.**

| Finding | Figure | Source | Flag |
|---|---|---|---|
| Exploitation of vulnerabilities as initial breach vector | **14% (2024) → 20% (2025)**, fastest-growing top-3 vector; overtook phishing in 2025 | Verizon DBIR 2024/2025 | [INDEPENDENT-ish]* |
| Edge devices / VPNs as the exploited asset | **22% of exploitation breaches (≈8× rise from 3%)**; median time-to-mass-exploit for new critical edge vulns = **0 days** | Verizon DBIR 2025 | [INDEPENDENT-ish]* |
| Exploits = #1 initial infection vector (5th year running) | **33%** of intrusions; the 4 most-exploited vulns were all **edge devices** | Mandiant M-Trends 2025 | [VENDOR] |
| Exposed remote services (RDP) as initial access | **~65%** of ransomware IR cases; RDP abused in **90%** of attacks handled | Sophos Active Adversary 2024 | [VENDOR] |
| Exploited vulnerabilities = #1 root cause of ransomware | **32%** of incidents (2nd year running); worst outcomes (67% encryption, $3.58M avg recovery) | Sophos State of Ransomware 2024 | [VENDOR] |
| New CVEs confirmed exploited in the wild | **768 in 2024 (+~20% YoY)**; ransomware groups weaponise KEV entries | CISA KEV Catalog | [INDEPENDENT] |

*\*Verizon DBIR is vendor-published but analyses real incident data (10k+ breaches) and is treated as the field's most rigorous source.*

**Sales translation:** the thing German Shepherd shows you — exposed, exploitable internet-facing infrastructure — is now the **#1 or fastest-growing way businesses actually get breached.** This is not a "nice-to-have data feed"; it is the dominant loss driver.

---

## 3. How often it happens (frequency / base rate)

| Population | Rate (per year) | Source | Flag |
|---|---|---|---|
| UK businesses identifying any breach/attack | **43% (2025)**, 50% (2024); **medium 67%, large 74%** | UK Gov Cyber Security Breaches Survey | [INDEPENDENT] (National Statistic) |
| Organisations hit by **ransomware** | **59%** (2024) | Sophos State of Ransomware | [VENDOR] |
| Firms experiencing ≥1 cyberattack | **67%** (up from 53%) | Hiscox Cyber Readiness 2024 | [VENDOR — upper bound, sample-biased] |
| **Insured** cyber claims frequency | **~1.48% per policy/year** (2024, fell 7% YoY) | Coalition 2025 Cyber Claims Report | [VENDOR — but the right number for insurer P&L] |

**Why two very different numbers?** "43% get attacked" counts every phishing email; "1.48% file a claim" is the rate at which an insurer actually pays. **For the ROI model we use the insurer claim rate (~1.5%)** because that is what hits Bolttech's loss ratio. The 43% independent base rate is the backdrop that proves the exposure is real and common.

---

## 4. How much it costs when it happens (severity)

Severity figures span two orders of magnitude depending on the source's sample. The honest framing: **independent UK-government figures are low** (they include millions of micro-firms with ~£0 incidents and are self-reported); **cross-carrier claims data and vendor reports are high** (they capture the incidents that actually cost money). For an insurer pricing real claims, the **cross-carrier NetDiligence number is the right anchor.**

| Measure | Figure | Source | Flag |
|---|---|---|---|
| **SME average cyber claim (cross-carrier)** | **~$205K (2024) → ~$264K (2025)** ≈ **£160K–£208K** | NetDiligence Cyber Claims Study (10k+ real claims) | [INDEPENDENT] |
| SME ransomware claim | **~$432K ≈ £340K** (with recovery ~$961K) | NetDiligence | [INDEPENDENT] |
| Large company (>$2B rev) avg incident | **~$13.8M** | NetDiligence | [INDEPENDENT] |
| Global average breach cost | **$4.88M (2024) → $4.44M (2025)**; **orgs <500 staff $3.31M (2024)** | IBM Cost of a Data Breach | [VENDOR] |
| Avg ransom payment / recovery cost | **$1.0M ransom + $1.53M recovery (2025)** | Sophos | [VENDOR] |
| UK "most disruptive breach" — all businesses | **£1,600** (£3,550 excluding £0 responses); 95th pct ~£4K (small), ~£10K (medium/large) | UK Gov Survey 2025 | [INDEPENDENT] |
| UK large-business direct cost | **£17,970** (2024) | UK Gov Survey 2024 | [INDEPENDENT] |
| Commercial burglary (UK) | >25% of businesses victims, losing **>£10,000** each (secondary); Home Office CVS: ~8% premises burgled | Safe.co.uk/FSB; Home Office Commercial Victimisation Survey | [SECONDARY] / [INDEPENDENT] |

**Model anchor:** conservative SME cyber claim severity = **£160,000** (low end of the independent NetDiligence range).

---

## 5. The insurance-economics linkage — does outside-in screening actually cut claims?

**Independent proof (use these first):**

| Finding | Figure | Source | Flag |
|---|---|---|---|
| Poor security rating → breach likelihood | Orgs rated **≤400 are 5× more likely** to be breached; **300–500 are 7.9× more likely** to be a ransomware target; breach prob **<1% (≥700) vs ~3% (<500)** | BitSight data, analysed with **Marsh McLennan** (27,458 cos / 2,671 breaches) | [INDEPENDENT analysis] |
| Specific controls → fewer incidents | **Automated hardening = ~6× less likely** to suffer an incident; **MFA = 1.4× less likely** | Marsh McLennan Cyber Risk Analytics Center (real claims data) | [INDEPENDENT] |

**Carrier "active insurance" proof (on-point but vendor-marketing):**

| Carrier | Result | Source | Flag |
|---|---|---|---|
| Coalition | Policyholders had **73% fewer claims than industry avg**; **85,000 alerts → 32,000+ issues mitigated**; **$31M clawed back** | Coalition 2025 Claims Report | [VENDOR] |
| At-Bay | Portfolio ransomware frequency **~7× below industry**; insureds remediate vulns **~5× faster** | At-Bay InsurSec 2025 | [VENDOR] |
| Cowbell | Reported claims rate **<3% since inception (~3× below industry)** | Cowbell | [VENDOR] |

**Market context:** US cyber loss ratios sit at **41.6% (2023) → 48.8% (2024)** [INDEPENDENT — AM Best / NAIC]. The market is profitable but tightening, so any claims-frequency reduction drops straight to the combined ratio.

**The honest read:** the carrier 73% / 7× / 3× numbers are self-reported against vendor-chosen baselines — treat as illustrative. But the **independent** Marsh/BitSight research (5×, 6×, 7.9×) confirms the *direction and magnitude*: visible, remediated attack surface materially lowers breach probability. **German Shepherd does not need to be as good as Coalition** — the model below assumes it captures a fraction of that effect.

---

## 6. The worked ROI model (deliberately conservative)

We model the lever that hits Bolttech's P&L directly: **expected claims cost on an SME book.**

**Inputs (all conservative, independent where possible):**
- Cyber claim frequency: **1.5% / policy / year** (Coalition insured rate)
- Avg SME cyber claim severity: **£160,000** (low end, NetDiligence independent)
- → **Expected loss cost per policy = 1.5% × £160,000 = £2,400 / year**

### Worked example — a modest 1,000-policy SME book

- Expected claims/year = 1.5% × 1,000 = **15 claims**
- Expected annual loss cost = 1,000 × £2,400 = **£2.4M**

| Claims-frequency reduction German Shepherd drives | Annual £ saved | ROI vs £20k pilot |
|---|---|---|
| **0.83% (break-even)** | £20,000 | **1.0× (pays for itself)** |
| 1% | £24,000 | 1.2× |
| **5%** | £120,000 | **6×** |
| 10% | £240,000 | 12× |

> The carriers above claim **73% / ~85%** reductions. We assume **5%.** Even at that ~15× discount to the vendor evidence, the pilot returns **6×.**

### The single-claim framing (the one to say out loud)

- **£20,000 = 12.5% of one average SME cyber claim (£160K).**
- Influence the selection or remediation of **one** avoided claim and the pilot returns **8×**.
- One avoided SME **ransomware** claim (£340K) returns **17×**.
- **Break-even = preventing 0.125 of a single claim** — i.e. a **0.83% reduction** in claims frequency across the book. Anything better than that is pure profit.

### Loss-ratio framing (for the underwriter in the room)

At a 48.8% cyber loss ratio, a 5% claims-frequency cut on the book improves the loss ratio by **~2.4 points (48.8% → ~46.4%)** — a material move in a softening market, for a £20k fixed fee.

### Scaling to Bolttech's actual footprint

Bolttech intermediates **~$85bn in quoted premium across 230+ insurers**. The 1,000-policy example is a rounding error of their network. A **1% reduction on 100,000 policies = £2.4M/year saved** — at which point £20,000 is **0.8% of the value created** and the conversation is about a rev-share, not a fee.

---

## 7. Price benchmark — £20k is cheap, not expensive

| Comparable (outside-in / security ratings / ASM) | Price | Source | Flag |
|---|---|---|---|
| **UpGuard Starter** (cheapest *published* paid plan in the category) | **~$19,188/yr ≈ £15.1k** (self-serve, 50 vendors) | UpGuard pricing page | [OFFICIAL] |
| UpGuard Professional | ~$39,996/yr ≈ £31.5k | UpGuard | [OFFICIAL] |
| SecurityScorecard | avg ACV **~$26k**; list $25k–$50k (SMB), $100k+ enterprise | Vendr buyer data | [AGGREGATOR EST.] |
| BitSight | **$50k–$70k/yr list** (150 vendors) | Vendr | [AGGREGATOR EST.] |
| RiskRecon (Mastercard) | custom, six-figure enterprise | Capterra/inference | [INFERENCE] |
| Per single outside-in assessment | **$1,000–$5,000 ≈ £790–£3,940** each | Security.org / IBSSCORP 2026 | [INDUSTRY] |
| Insurer adoption of external scans in underwriting | **~75% of cyber carriers** already do this | BitSight | [VENDOR] |

**Conclusions:**
- £20,000 (~$25.4k) ≈ the **entry self-serve tier** of the category (it sits between UpGuard Starter and SecurityScorecard's average ACV) — and that's for off-the-shelf SaaS, **not** a bespoke insurer feed with reseller rights.
- On a **per-assessment** basis, £20k buys only **~5–25 company reports** at the $1k–$5k market rate. Any pilot covering a meaningful portfolio is **below market per unit.**
- Insurer-grade deployments (RiskRecon, BitSight cyber-insurance modules) are routinely **six figures.** £20k for 12 months + reseller rights is a fraction of a single enterprise seat.

---

## 8. Pricing decision & recommendation

**Hold the £20,000 for *this* pilot — but treat it as a land price, not the value price.**

Rationale:
- **It's defensibly cheap.** Every comparator's entry tier is at or above £20k, and the ROI is 6×+ on a tiny book. You are not underpricing the *outcome*; you are buying a marquee logo ($2.1B Bolttech), reseller distribution into 230+ insurers, and the case studies that retire the "is this real demand?" risk. That is the right trade for a first paid pilot.
- **It matches your own pricing DNA.** Your Notion playbook anchors ARPA at **£20k / £30k / £60k** and validates price with the **~75%-yes experiment** (raise after a yes). Bolttech said yes at £20k with no friction — that is a signal to **anchor expansion higher**, not to discount further.

**Expansion / commercial-agreement pricing (where the real money is):**

| Lever | Suggested structure |
|---|---|
| Platform access per insurer in the network | **£30k–£60k/yr** ARPA (your existing tiers; still below BitSight/SecurityScorecard enterprise) |
| Per-policy / per-assessment screening | **£25–£150 per building profiled** (vs £790–£3,940 market per-assessment → you're 5–40× cheaper and still high-margin) |
| Reseller / distribution | **Rev-share** on premium written against German-Shepherd-screened risk, or a per-policy data fee — this is the line that scales with Bolttech's $85bn, not a flat licence |
| Outcome kicker (optional, credibility play) | Tie a portion of fee to measured loss-ratio improvement on a cohort — you have the carrier precedent (Coalition/At-Bay) to make this concrete |

**Net:** keep £20k to win the pilot; structure the commercial agreement so price scales with the network and with proven loss avoidance. Re-run the 75%-yes test at the insurer-network tier (£30k+).

---

## 9. Five value statements for the deck / call

1. **"Exposed, exploitable infrastructure is now the #1 way businesses get breached (Mandiant: 33%; Verizon: up to 20% and climbing). German Shepherd shows you that exposure on every policyholder address — before you bind."**
2. **"One average SME cyber claim is £160,000. The pilot is £20,000 — 12.5% of a single claim. Influence one avoided loss and it returns 8×; an avoided ransomware claim returns 17×."**
3. **"On a 1,000-policy SME book we only need to cut claims by 0.83% to break even. Carriers running outside-in screening report 73% fewer claims (Coalition) — we've modelled 5%, and it still returns 6×."**
4. **"Independent Marsh/BitSight data: companies with poor, un-remediated attack surface are 5–7.9× more likely to be breached. We turn that 7.9× into a pre-bind decision."**
5. **"£20k is the price of UpGuard's cheapest self-serve plan — and below SecurityScorecard's average contract. For that you get a bespoke insurer feed, integration, and resale rights into your 230+ carrier network. The category floor, for an enterprise outcome."**

---

## Appendix — source list (grouped)

**Independent (lead with these):** UK Gov Cyber Security Breaches Survey 2024/2025; Verizon DBIR 2024/2025; CISA KEV Catalog; NetDiligence Cyber Claims Study 2024/2025; AM Best / NAIC cyber market reports; Marsh McLennan Cyber Risk Analytics Center (controls + BitSight breach-correlation study); Home Office Commercial Victimisation Survey; GlobalData UK SME Insurance Survey.

**Vendor / marketing (corroborating, flag as such):** IBM Cost of a Data Breach; Hiscox Cyber Readiness; Sophos State of Ransomware + Active Adversary; Mandiant M-Trends; Coalition / At-Bay / Cowbell claims reports; Allianz Commercial cyber trends; BitSight (raw ratings data); UpGuard/SecurityScorecard/BitSight pricing (Vendr/G2/official).

**Caveats carried forward:** (1) Several primary PDFs (IBM, NetDiligence, Sophos, GOV.UK) returned HTTP 403 to direct fetch; figures are corroborated via official press releases and indexed extracts — verify exact 2025 size-bands against source PDFs before any externally published version. (2) Carrier "active insurance" effect sizes are self-reported against vendor-chosen baselines — pair with independent Marsh/BitSight numbers. (3) **Do NOT** cite the "60% of small businesses close within 6 months of a cyberattack" line — it is disavowed by its own purported source (NCSA) and debunked (Nextgov, 2017). Use Verizon DBIR's **19% of SMBs face bankruptcy after an attack** instead.
