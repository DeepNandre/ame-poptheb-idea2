"""D — Simulation worker.

Synthesises ethical physical-access approach scenarios from everything the prior phases
produced (3D model + people + OSINT). This is the one phase with no pre-existing engine,
so it's a single grounded LLM call over the collected facts. Authorised security research
only. Needs OPENAI_API_KEY; without it the job ends 'unavailable', never faked.

Output (stored on the job): scenarios=[{name, approach, vector, challenge_response, likelihood, notes}].
"""

import json
import os

import store

SYSTEM = (
    "You are a physical-security analyst supporting an AUTHORISED red-team assessment of a "
    "building. Using only the supplied reconnaissance facts, model how an ethical assessor "
    "would plan an approach: realistic entry vectors, the social-engineering pretext, the "
    "challenge/response they'd face, and a likelihood. Be specific to the facts given; do not "
    "invent capabilities. Return ONLY JSON: "
    '{"scenarios":[{"name","approach","vector","challenge_response","likelihood":"low|medium|high","notes"}]}'
)


def _gather_facts(slug: str) -> dict:
    bdir = store.building_dir(slug)
    facts: dict = {"address": store.read_meta(slug).get("address"), "slug": slug}

    # A0/A1 — model shape (floors, entrances, key spaces) without dumping the whole graph.
    bjson = bdir / "building.json"
    if bjson.exists():
        try:
            b = json.loads(bjson.read_text())
            ext = [n for n in b.get("nodes", []) if n.get("is_external")]
            facts["model"] = {
                "floors": len(b.get("floors", [])),
                "entrances": len(ext),
                "spaces": sum(
                    1 for n in b.get("nodes", []) if n.get("kind") == "space"
                ),
                "shallow_rooms": [
                    n.get("label")
                    for n in b.get("nodes", [])
                    if n.get("kind") == "space" and (n.get("entrance_depth") or 99) <= 2
                ][:12],
            }
        except (json.JSONDecodeError, OSError):
            pass

    # B — people (high-value first, trimmed).
    pj = store.get_job(slug, "people") or {}
    facts["people"] = [
        {
            "name": p.get("name"),
            "role": p.get("role"),
            "high_value": p.get("high_value"),
        }
        for p in (pj.get("people") or [])[:20]
    ]

    # C — exposed devices (trimmed).
    oj = store.get_job(slug, "osint") or {}
    facts["exposed_devices"] = [
        {"product": d.get("product"), "port": d.get("port"), "ip": d.get("ip")}
        for d in (oj.get("devices") or [])[:20]
    ]
    return facts


def run_simulate(slug: str) -> None:
    """Blocking — run inside a FastAPI BackgroundTask (Starlette threadpool)."""
    store.set_job(
        slug,
        "simulate",
        status="running",
        started_at=store.now(),
        finished_at=None,
        error=None,
        scenarios=[],
    )

    if not os.environ.get("OPENAI_API_KEY"):
        store.set_job(
            slug,
            "simulate",
            status="unavailable",
            error="OPENAI_API_KEY not set — simulation needs an LLM",
            finished_at=store.now(),
        )
        return

    try:
        import openai

        facts = _gather_facts(slug)
        client = openai.OpenAI()
        resp = client.chat.completions.create(
            model=os.environ.get("SIMULATE_MODEL", "gpt-4o"),
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": json.dumps(facts)},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        scenarios = data.get("scenarios", [])
        (store.building_dir(slug) / "simulation.json").write_text(
            json.dumps(data, indent=2)
        )
        store.set_job(
            slug,
            "simulate",
            status="complete",
            finished_at=store.now(),
            scenarios=scenarios,
            scenario_count=len(scenarios),
        )
    except Exception as e:  # noqa: BLE001
        store.set_job(
            slug,
            "simulate",
            status="failed",
            error=f"{type(e).__name__}: {e}",
            finished_at=store.now(),
        )
