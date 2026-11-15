import { MongoClient, type Db } from "mongodb";
import { assertProdSecrets, env } from "./env";

declare global {
  var __mongo: { client: MongoClient; db: Db } | undefined;
}

export async function getDb(): Promise<Db> {
  assertProdSecrets();
  if (global.__mongo) return global.__mongo.db;
  const client = new MongoClient(env.mongoUri, { maxPoolSize: 10 });
  await client.connect();
  const db = client.db(env.dbName);
  global.__mongo = { client, db };
  await ensureIndexes(db);
  return db;
}

let indexesReady = false;
async function ensureIndexes(db: Db) {
  if (indexesReady) return;
  indexesReady = true;
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ userId: 1, expiresAt: 1 }),
    db.collection("services").createIndex({ createdAt: -1 }),
    db.collection("services").createIndex({ name: "text", description: "text" }),
    db.collection("incidents").createIndex({ serviceId: 1, state: 1, createdAt: -1 }),
    db.collection("incidents").createIndex({ createdAt: -1, _id: -1 }),
    db.collection("incident_events").createIndex({ incidentId: 1, at: 1 }),
    db.collection("deploys").createIndex({ serviceId: 1, at: -1 }),
    db.collection("runbooks").createIndex({ name: "text" }),
    db.collection("slos").createIndex({ serviceId: 1 }, { unique: true }),
    db.collection("api_keys").createIndex({ keyHash: 1 }, { unique: true }),
    db.collection("api_keys").createIndex({ userId: 1, revokedAt: 1 }),
    db.collection("audit").createIndex({ at: -1 }),
    db.collection("rate_buckets").createIndex({ key: 1 }, { unique: true }),
  ]);
}

export async function closeDb() {
  if (!global.__mongo) return;
  await global.__mongo.client.close();
  global.__mongo = undefined;
  indexesReady = false;
}
