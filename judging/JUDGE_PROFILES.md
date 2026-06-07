# Pop The Bubble — Judge Profiles & Scoring Framework

> **Purpose.** This is the research layer for our judging "panel of agents." Each
> judge below is reconstructed from their public X / LinkedIn / GitHub / portfolio
> footprint into a *persona* with a known taste, lens, and hot buttons. When we
> assess the dashboard, evidence, live URL, GitHub repo, and demo, we run each
> persona over the work, write their individual report, then have them debate and
> converge on a score + the parts to lean into + where to improve.
>
> **Status of sourcing.** Profiles are inferences from public footprints (cited
> per person). They are directional, not gospel — treat them as "how this kind of
> person is likely to judge," and recalibrate once we see them react live.
>
> **⚠️ Open item — the official scoring is not yet loaded.** The hackpack at
> `popthebubblehack.co.uk/hackpack` blocks automated fetching (HTTP 403), so the
> *official* "how to get points / how to win" rules are **not** baked into the
> rubric below yet. The rubric in §8 is a sensible hackathon-standard default.
> **Paste the official points/winning criteria and I'll re-weight the rubric to
> match it before the next assessment pass.**

---

## 1. Lois Zhao — `@zmzlois` / in/loiszhao

**One-liner:** Deep-infra / dev-tools engineer. The "is this real?" technical conscience of the panel.

- **Role / background:** Platform engineer at **Zephyr Cloud** (the team behind
  **Module Federation**); works between SF and London. Heavy open-source
  footprint (`rspack` — Rust web bundler, 12k+ stars; `LinkGoGo`; k3s IaC;
  React-internals reading notes; `frontline` — "coding agents understand browser
  context"). Speaker (Sessionize); has applied to YC / founded.
- **Stack & taste:** Rust, TypeScript, Go, Elixir, Kubernetes. Cares about
  bundlers, performance, micro-frontends, infra correctness, and **agent tooling
  for developers**.
- **Focus:** **Software / deep technical** — not go-to-market.
- **Likes to see:** Real engineering, honest architecture, things that actually
  run, clean repo, no smoke-and-mirrors. Will respect "we degrade gracefully when
  a key is missing" and an honest README.
- **Hot buttons (will dock points):** Fake/mocked data dressed up as live, hand-wavy
  "AI" with no substance, broken builds, hidden complexity, marketing fluff in
  place of substance.
- **How to win her:** Show the WebSocket/engine plumbing, show the no-mock policy,
  let her read the code and find it's exactly what the UI claims.
- *Sources:* github.com/zmzlois, x.com/zmzlois, sessionize.com/lois-zhao, linkedin.com/in/loiszhao, zephyr-cloud.io.

## 2. Lyndon Leong — `@Lantos1618` / in/lyndon-leong-25b704b2

**One-liner:** Builder-founder at a hyper-selective fellowship; fintech + AI-agents brain.

- **Role / background:** Associated with **EWOR** (founder fellowship — €500k per
  fellow, ~0.1% acceptance). Fintech & AI enthusiast; tinkers with AI agents
  publicly (`lyndon.codes` — "AI RPG party members"). Educated at Macquarie.
- **Focus:** **Hybrid** — leans builder/technical but immersed in the
  venture/founder world, so he reads both the code *and* the business.
- **Likes to see:** Clever agentic systems, a real wedge, something that could
  become a company. Appreciates a working agent loop, not a prompt wrapper.
- **Hot buttons:** Toy demos with no path to a business; "agent" that's just one
  LLM call; no defensibility.
- **How to win him:** Frame the wedge crisply ("planning record = the inside of a
  building"), show the agent actually routing intents, hint at the venture story.
- *Sources:* x.com/Lantos1618, linkedin.com/in/lyndon-leong-25b704b2, lyndon.codes, ewor.com.

## 3. Aruzhan N. — `@arukanism` / in/aruzhan-n

**One-liner:** Ex-founder, Draper University & Palantir-fellow energy; agentic-AI + web3 + VC lens.

- **Role / background:** Previously **Founder @ Draper University**; **Palantir
  Fellow**; London-based (Kazakhstan roots, Haileybury Almaty). Stated interests:
  **agentic AI, web3, venture capital.**
- **Focus:** **Go-to-market / founder + AI** — investor-style pattern matching on
  founders and markets, with genuine AI-product literacy.
- **Likes to see:** A sharp problem, an unusual insight, founder grit, a product
  that *feels* inevitable. Palantir background → likes **data-fusion / OSINT /
  intelligence-surface** products (this is directly in our lane).
- **Hot buttons:** Solution looking for a problem; weak "why now"; no user/market
  validation; ethically careless data products.
- **How to win her:** Lead with the insight and the validation/proof; show the
  Palantir-flavoured data-fusion angle and that we've thought about ethics/scope.
- *Sources:* linkedin.com/in/aruzhan-n, x.com/arukanism, Draper University, Palantir Fellowship.

## 4. Alramina Myrzabekova — `@dimplnotsimpl` / in/alramina-mz

**One-liner:** EWOR Fellow + EY technology consultant; politics-economics brain — the "so what's the business + is it credible" voice.

- **Role / background:** **EWOR Fellow**; **Technology Consultant @ EY**; prior
  Kickstart Global, Women Who Build. BSc Politics & Economics, **King's College
  London**; Stanford exposure. London-based.
- **Focus:** **Go-to-market / commercial + delivery credibility.** Consulting lens
  → market sizing, buyer, feasibility, risk, polish.
- **Likes to see:** Clear ICP and buyer (e.g. "insurers", "security teams"),
  a credible go-to-market, professional presentation, traction/validation,
  thought-through risk & ethics.
- **Hot buttons:** Vague market, no buyer, sloppy deck/dashboard, hype without
  evidence, regulatory/ethics blind spots.
- **How to win her:** A tight problem→solution→proof narrative, a named customer
  segment, and a dashboard that looks board-ready.
- *Sources:* linkedin.com/in/alramina-mz, x.com/dimplnotsimpl, ewor.com, EY.

## 5. Oliver Ulvebne — `@therealoliulv` / in/oliverulvebne

**One-liner:** Serial AI-hackathon *winner* and accelerator director — knows exactly what wins a room.

- **Role / background:** **Director of Accelerate ME** (UK's leading student-led
  accelerator, Univ. of Manchester). Built **Mistralverse** (autonomous AI
  civilization of agents); **won both xAI and Mistral AI hackathons.** Norwegian,
  web3, actively uses **Claude Code**.
- **Focus:** **Builder + go-to-market + showmanship.** He's been on our side of the
  table and won — he judges *demo craft* and *agentic ambition* hard.
- **Likes to see:** Bold, autonomous, agentic systems; a demo that lands a
  "wow" in the first 30 seconds; fast shipping; clever use of frontier models;
  narrative energy.
- **Hot buttons:** Slow/buggy demos, burying the lede, low ambition, a build that
  doesn't actually run live, generic SaaS with no spark.
- **How to win him:** Open the demo on the single most jaw-dropping moment (live
  3D map → real signals → recon in one breath), show real autonomy, keep it fast.
- *Sources:* x.com/therealoliulv, oliulv.com, linkedin.com/in/oliverulvebne, Accelerate ME, Mistralverse.

## 6. Eldar Utiushev — `@e1daru` / in/eldaru

**One-liner:** Data scientist + full-stack engineer — the "show me the data and the implementation" judge.

- **Role / background:** Data scientist & full-stack developer (portfolio at
  `e1daru.github.io`) spanning data analytics, ML, and software engineering.
- **Focus:** **Software / technical, data-leaning.**
- **Likes to see:** Real data pipelines, sound methodology, correctness, working
  end-to-end implementation, honest treatment of model/heatmap limitations.
- **Hot buttons:** Statistically dishonest visuals (e.g. a "heatmap" that's
  actually random), overclaiming model capability, brittle code.
- **How to win him:** Be explicit about what's estimated vs measured (our heatmap
  honesty note is exactly his language), show the data flow end-to-end.
- *Sources:* e1daru.github.io, x.com/e1daru, linkedin.com/in/eldaru.

---

## 7. Panel composition — how the room splits

| Lens | Judges | What they reward |
|------|--------|------------------|
| **Deep technical / "is it real"** | Lois, Eldar | Honest engineering, working code, no mocks |
| **Builder + agentic ambition + demo craft** | Oliver, Lyndon | Autonomy, wow-moment, frontier-model use, speed |
| **Founder / GTM / commercial credibility** | Aruzhan, Alramina | Insight, market, buyer, validation, ethics |

**Implication for us:** we must win on **three axes at once** — (a) the code is
genuinely real and honest (Lois/Eldar), (b) the demo is fast and feels
autonomous/ambitious (Oliver/Lyndon), and (c) the problem, buyer and proof are
crisp and ethically handled (Aruzhan/Alramina). A build that's technically real
but a boring demo loses Oliver; a flashy demo with fake data loses Lois and Eldar
instantly. Our existing **no-mock / honest-limitations** posture is a strong fit
for half the panel — we should make it *visible*, not buried.

---

## 8. Scoring rubric (DEFAULT — replace with official hackpack points)

Standard hackathon criteria, 0–10 each, until the official "how to get points"
is supplied. Synthesised from common rubrics (TAIKAI, CGU Ethical-AI, Ansys, MS Learn).

| # | Criterion | Weight | What strong looks like here |
|---|-----------|--------|------------------------------|
| 1 | **Problem & insight** | 20% | Non-obvious wedge ("the planning record is the *inside* of a building"); clear who hurts |
| 2 | **Validation / proof** | 15% | Evidence the problem is real + the solution works; real data, real users/segments |
| 3 | **Technical execution** | 20% | Real engineering, runs live, honest architecture, no mocks |
| 4 | **Innovation / agentic ambition** | 15% | Genuine autonomy, frontier-model use, novelty |
| 5 | **Impact & GTM** | 15% | Named buyer (insurers/security), path to a company, market size |
| 6 | **Demo & presentation** | 10% | Fast, lands a wow in 30s, dashboard is board-ready |
| 7 | **Ethics / scope / responsibility** | 5% | Especially for a recon/OSINT product — scope limits, consent, disclosure |

**Composite score** = weighted average across all six personas, with each persona
weighting the criteria toward their lens (e.g. Lois over-weights #3, Oliver
over-weights #4/#6, Alramina over-weights #5/#2).

---

## 9. Assessment protocol (re-run this every iteration)

1. **Inputs:** dashboard URL, evidence/proof artifacts, GitHub repo, demo (video or live).
2. **Per-persona report:** for each of the 6 judges, write — *first impression →
   what they'd praise → what they'd dock → their criterion-by-criterion scores →
   their one biggest "fix this" note.*
3. **Panel debate:** personas argue (technical-vs-GTM tension is the key axis);
   surface disagreements explicitly; note where one persona's praise is another's
   red flag.
4. **Converged output:**
   - **Overall score** (weighted composite) + per-criterion breakdown.
   - **Top 3 strengths to lean into** (and how to make them *visible* to judges).
   - **Top 3–5 improvements**, ranked by score impact × effort.
   - **The single highest-leverage change** before demo day.
5. **Diff vs last pass:** when re-run after edits, report what moved and why.

> Keep this file updated as we learn how the judges actually react; tighten the
> personas with any real signal from the event.
</content>
</invoke>
