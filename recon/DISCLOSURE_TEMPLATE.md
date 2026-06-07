# Responsible Disclosure — draft (fill in once a finding is CONFIRMED)

> Submit to the vendor's program FIRST. Do not CC a regulator on day one.
> - Lime → https://bugcrowd.com/lime
> - Voi → https://app.intigriti.com/programs/voi/voiscooters/detail (software only)
> - Dott → privacy@ridedott.com (no public bounty found; ask for security escalation)

---

**Title:** [Operator] public GBFS feed exposes a stable vehicle identifier enabling rider trip de-anonymisation

**Severity (proposed):** Medium–High (privacy / personal-data exposure). OWASP API3 (BOLA-adjacent) / API1.

**Summary:**
The public, unauthenticated `free_bike_status` feed for [city] returns a vehicle identifier that does
**not** rotate per trip as required by GBFS v2.0+. Because the identifier persists across a rental, a
third party polling only public data can correlate a vehicle's disappearance and reappearance to
reconstruct individual riders' trip origin/destination pairs — re-identifiable with as few as 4 points.

**Affected endpoint:**
`<exact URL captured>`  — auth required: NO.

**Steps to reproduce (self-ride PoC — no third-party data):**
1. Capture the public feed once per minute for ~60 min (tool: `gbfs_audit.py poll`).
2. Rent and return ONE bike on my own account at a recorded start/end time + location.
3. Run `gbfs_audit.py analyze ... --ride-start <ts> --ride-end <ts> --start-latlon .. --end-latlon ..`.
4. Observed: the same identifier `<id>` appears at the start location, vanishes during my ride, and
   reappears at my end location ~<N> minutes later — i.e. my own trip is reconstructable from public data.

**Evidence:** [redacted snapshots: only my own vehicle; no other riders' data collected.]

**Impact:** Reconstruction of trip O/D pairs for riders from public data, without consent — a UK GDPR
concern under Art. 25/32 (the GBFS rotation requirement is the expected pseudonymisation measure).

**Recommended fix:** Rotate `bike_id`/`vehicle_id` to a fresh random value after every trip, per GBFS v2.x;
do not embed a stable identifier in `rental_uris`.

**Disclosure terms:** Reported [date/time, with timestamp]. Happy to give reasonable time to remediate
before any public writeup. No data on other users was accessed or retained.

**Reporter:** [name] — [contact]
