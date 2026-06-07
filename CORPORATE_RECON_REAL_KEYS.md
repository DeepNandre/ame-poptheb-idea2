# How to use REAL Shodan + Censys data (no mocks)

## 1. Shodan

- Go to: https://account.shodan.io/
- Copy the long string under **"Your API Key"**.
- The page you visited (https://developer.shodan.io/api/clients) is only for viewing your current usage / rate limits. You don't need to create anything there — just use the key from the account page.

Put it in `.env.local`:

```env
SHODAN_API_KEY=your_actual_shodan_key_here
```

## 2. Censys (you already did this correctly)

You created a Personal Access Token at:
https://accounts.censys.io/settings/personal-access-tokens

You put the value under `CENSYS_API_TOKEN=` in `.env.local` (the code now prefers this modern token and uses `Authorization: Bearer ...`).

Example (do **not** commit the real value):

```env
CENSYS_API_TOKEN=censys_your_personal_access_token_here
```

(The old CENSYS_API_ID / CENSYS_API_SECRET fields are only for the ancient style — you can leave them empty.)

## 3. Restart the backend after editing .env.local

```bash
# Stop the current `npm run api` (Ctrl+C)
# Then start it again:
npm run api
# or
npm run dev:full
```

This is required so the Node process reloads the environment variables before spawning the Python OSINT scripts.

## 4. Test that it's using real data

In the UI:
- Click **Scan** (so you have live devices)
- Click **Recon**

In the Corporate Recon panel you should **no longer** see the "SHODAN_API_KEY not set" or "Censys ... mocked" notes for the sources you configured (the notes will only mention the parts that are still mocked, e.g. subdomains if you don't have subfinder/theHarvester installed).

## 5. Rate limits (important for hackathon)

- **Shodan free**: very low (around 100 searches per month for the basic API).
- **Censys free**: limited concurrent actions (the screenshot you sent said "1 concurrent action").

Use the Recon feature sparingly during testing. If you burn the quota, you'll fall back to mocks for that source until the limit resets.

## Quick local test (bypasses the UI)

```bash
# Make sure your keys are in the environment for this shell
export SHODAN_API_KEY=...
export CENSYS_API_TOKEN=...

python3 server/osint_engine.py --company "Your Company Name" --address "Bankside Yards, London" --pretty
```

If it returns real IPs/ports/services from Shodan or Censys, you're good.

The code in `server/osint_engine.py` now does:

- If `SHODAN_API_KEY` is present → real Shodan query
- If `CENSYS_API_TOKEN` is present → real Censys query using Bearer token (what you have)
- Falls back to legacy ID+Secret only if the token is missing
- Only uses mocks when the corresponding key is completely absent

Everything is ready — just put the real Shodan key in `.env.local`, make sure the Censys token is under `CENSYS_API_TOKEN`, restart `npm run api`, and you'll get real data.