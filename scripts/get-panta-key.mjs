// Creates (or logs into) your Panta account, mints an API key, and saves it to .env.local.
// Run it yourself:  node scripts/get-panta-key.mjs
// Your password is typed into this terminal only. It is sent to Panta and nowhere else.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const BASE = "https://live-api.panta.market/api/v1";
const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");

function ask(question, { hidden = false } = {}) {
  return new Promise((done) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write("*");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      done(answer.trim());
    });
  });
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function saveKey(secret) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  if (/^PANTA_API_KEY=.*$/m.test(content)) {
    content = content.replace(/^PANTA_API_KEY=.*$/m, `PANTA_API_KEY=${secret}`);
  } else {
    content = `PANTA_API_KEY=${secret}\n${content}`;
  }
  writeFileSync(ENV_PATH, content);
}

async function main() {
  console.log("\nPanta API key setup for BYLINE\n");
  const email = await ask("Email: ");
  const password = await ask("Password (new or existing, min 8 chars): ", { hidden: true });
  if (!email || !password) {
    console.error("Email and password are required.");
    process.exit(1);
  }

  let access = null;
  const reg = await post("/auth/register/", { email, password, name: "BYLINE" });
  if (reg.ok && reg.json?.access) {
    console.log("Account created.");
    access = reg.json.access;
  } else if (reg.json?.code === "EMAIL_TAKEN" || reg.status === 409) {
    console.log("Account already exists, logging in...");
    const login = await post("/auth/token/", { email, password });
    if (!login.ok || !login.json?.access) {
      console.error(`Login failed: ${login.json?.message ?? login.status}`);
      process.exit(1);
    }
    access = login.json.access;
  } else {
    console.error(`Sign-up failed: ${reg.json?.message ?? reg.json?.code ?? reg.status}`);
    if (reg.json?.fields) console.error(reg.json.fields);
    process.exit(1);
  }

  const key = await post(
    "/account/keys/",
    { env: "live", name: "byline", revokeOthers: false },
    { Authorization: `Bearer ${access}` },
  );
  const secret = key.json?.secret;
  if (!key.ok || typeof secret !== "string") {
    console.error(`Could not create API key: ${key.json?.message ?? key.json?.code ?? key.status}`);
    process.exit(1);
  }

  saveKey(secret);
  console.log(`\nDone. Key ${secret.slice(0, 12)}... saved to .env.local as PANTA_API_KEY.`);
  console.log('Go back to Claude and say "key saved".\n');
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
