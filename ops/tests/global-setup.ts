import { spawn, type ChildProcess } from "node:child_process";
import { MongoClient } from "mongodb";

let child: ChildProcess | null = null;

const BASE = "http://127.0.0.1:3100";
const URI = "mongodb://127.0.0.1:27017/cloudops_test";

async function waitFor(url: string, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`timeout waiting for ${url}`);
}

export async function setup() {
  const c = new MongoClient(URI);
  await c.connect();
  await c.db("cloudops_test").dropDatabase();
  await c.close();

  child = spawn("npx", ["next", "dev", "-p", "3100"], {
    env: {
      ...process.env,
      MONGODB_URI: URI,
      MONGODB_DB: "cloudops_test",
      JWT_SECRET: "test-secret-test-secret",
      NODE_ENV: "development",
      RATE_LIMIT_MULTIPLIER: "40",
    },
    shell: true,
    stdio: "ignore",
  });

  await waitFor(`${BASE}/api/health`, 150_000);
}

export async function teardown() {
  if (child?.pid) {
    await new Promise<void>((resolve) => {
      spawn("taskkill", ["/pid", String(child!.pid), "/T", "/F"], { shell: true }).on("exit", () => resolve());
    });
  }
  const c = new MongoClient(URI);
  await c.connect();
  await c.db("cloudops_test").dropDatabase();
  await c.close();
}
