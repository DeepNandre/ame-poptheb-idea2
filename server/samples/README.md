# Sample data for testing Phase 1 + Phase 2 locally

## Quick test (full pipeline)

```bash
# 1. Generate OSINT (mocked, fast)
python3 server/osint_engine.py --company "Acme Corp" --address "Bankside Yards, London" --mock > /tmp/osint.json

# 2. Correlate against sample devices (these have names like "iPhone-Alex", "linux-prod-01")
python3 server/corporate_recon.py \
  --osint-json /tmp/osint.json \
  --devices-json server/samples/devices.json \
  --pretty
```

You will see high-confidence matches for Alex, Priya, Jordan because the sample device names contain their first names, plus a "linux-prod-01" that matches tech stack / fingerprints.

## Real flow (when wired)

The Node server keeps the latest live devices from the scanner WebSocket stream.
When you trigger "Corporate Recon" (via button or natural language in the command bar), it:

1. Runs `osint_engine.py --company "..."` to get the intel.
2. Feeds the current live device list + the OSINT JSON into `corporate_recon.py`.
3. Broadcasts the result back to the frontend over the same WS the scanner uses.

The frontend then renders the Corporate Recon panel with:
- Subdomains
- Employees physically present right now (with device + confidence)
- Exposed infrastructure
- Tech stack
- All the per-device reasoning
