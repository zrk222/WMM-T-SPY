import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/cloudops";
const dbName = process.env.MONGODB_DB ?? "cloudops";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  for (const c of ["users", "services", "incidents", "incident_events", "deploys", "runbooks", "slos", "api_keys", "audit"]) {
    await db.collection(c).deleteMany({});
  }

  const now = new Date();
  const pw = await bcrypt.hash("Passw0rd!123", 10);

  const [admin, ops, viewer] = [
    { _id: new ObjectId(), email: "admin@cloudops.dev", name: "Ada Admin", role: "admin" as const, plan: "scale" as const },
    { _id: new ObjectId(), email: "ops@cloudops.dev", name: "Ola Ops", role: "operator" as const, plan: "team" as const },
    { _id: new ObjectId(), email: "viewer@cloudops.dev", name: "Vic Viewer", role: "viewer" as const, plan: "free" as const },
  ];

  await db.collection("users").insertMany(
    [admin, ops, viewer].map((u) => ({
      ...u,
      passwordHash: pw,
      tv: 0,
      lockedUntil: null,
      failedLogins: 0,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const services = [
    { _id: new ObjectId(), ownerId: admin._id, name: "checkout-api", description: "Payment authorization and capture", owner: "payments", tier: 1 as const, tags: ["prod", "money"], createdAt: now, updatedAt: now },
    { _id: new ObjectId(), ownerId: admin._id, name: "edge-router", description: "Public ingress and routing", owner: "platform", tier: 1 as const, tags: ["prod", "edge"], createdAt: now, updatedAt: now },
    { _id: new ObjectId(), ownerId: admin._id, name: "search-indexer", description: "Catalog indexing pipeline", owner: "discovery", tier: 2 as const, tags: ["batch"], createdAt: now, updatedAt: now },
    { _id: new ObjectId(), ownerId: admin._id, name: "notify-worker", description: "Email and push fan-out", owner: "growth", tier: 3 as const, tags: ["internal"], createdAt: now, updatedAt: now },
  ];
  await db.collection("services").insertMany(services);

  await db.collection("slos").insertMany([
    { _id: new ObjectId(), ownerId: admin._id, serviceId: services[0]._id, target: 99.95, windowDays: 30, indicator: "availability", updatedAt: now },
    { _id: new ObjectId(), ownerId: admin._id, serviceId: services[1]._id, target: 99.9, windowDays: 30, indicator: "latency", updatedAt: now },
  ]);

  await db.collection("runbooks").insertMany([
    {
      _id: new ObjectId(),
      name: "Checkout 5xx spike",
      serviceId: services[0]._id,
      steps: [
        { title: "Confirm the spike is real", command: "kubectl top pods -n payments" },
        { title: "Check upstream PSP status", command: "curl -s status.psp.example/health" },
        { title: "Fail over to secondary PSP", command: "ops psp failover --to secondary" },
        { title: "Verify 5xx rate returns to baseline", command: "ops metrics checkout_5xx --window 5m" },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      name: "Edge latency > 800ms",
      serviceId: services[1]._id,
      steps: [
        { title: "Inspect PoP distribution", command: "edgectl pops --latency" },
        { title: "Shed non-critical routes", command: "edgectl shed --class=static" },
        { title: "Open provider ticket if single-PoP", command: null },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const incId = new ObjectId();
  await db.collection("incidents").insertOne({
    _id: incId,
    ownerId: admin._id,
    serviceId: services[0]._id,
    title: "Checkout authorization 5xx above 4%",
    severity: "sev1",
    state: "acknowledged",
    impact: "critical",
    commander: "Ada Admin",
    openedBy: "ops@cloudops.dev",
    openedAt: new Date(Date.now() - 3600_000),
    ackAt: new Date(Date.now() - 3000_000),
    resolvedAt: null,
    resolutionNote: null,
    createdAt: new Date(Date.now() - 3600_000),
    updatedAt: now,
  });
  await db.collection("incident_events").insertMany([
    { _id: new ObjectId(), incidentId: incId, kind: "opened", actor: "ops@cloudops.dev", note: null, at: new Date(Date.now() - 3600_000) },
    { _id: new ObjectId(), incidentId: incId, kind: "acknowledged", actor: "Ada Admin", note: "PSP error rate is real, paging provider", at: new Date(Date.now() - 3000_000) },
    { _id: new ObjectId(), incidentId: incId, kind: "note", actor: "Ada Admin", note: "Failover to secondary started", at: new Date(Date.now() - 1500_000) },
  ]);

  await db.collection("deploys").insertMany([
    { _id: new ObjectId(), ownerId: admin._id, serviceId: services[0]._id, version: "2026.11.15-1", commit: "a1b2c3d", environment: "production", status: "succeeded", deployedBy: "ops@cloudops.dev", at: new Date(Date.now() - 7200_000) },
    { _id: new ObjectId(), ownerId: admin._id, serviceId: services[1]._id, version: "2026.11.15-2", commit: "e4f5g6h", environment: "production", status: "rolled_back", deployedBy: "Ada Admin", at: new Date(Date.now() - 5400_000) },
  ]);

  console.log("seeded");
  console.log("admin@cloudops.dev / Passw0rd!123 (admin, scale)");
  console.log("ops@cloudops.dev / Passw0rd!123 (operator, team)");
  console.log("viewer@cloudops.dev / Passw0rd!123 (viewer, free)");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
