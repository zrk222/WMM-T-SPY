import { ObjectId } from "mongodb";
import { incidents, services } from "./collections";

export async function dependenciesOf(id: ObjectId) {
  const svc = await (await services()).findOne({ _id: id });
  const ids = svc?.dependencies ?? [];
  if (ids.length === 0) return [];
  const rows = await (await services()).find({ _id: { $in: ids } }).toArray();
  return rows.map((r) => ({ id: r._id.toHexString(), name: r.name, openIncidents: 0 }));
}

export async function dependentsOf(id: ObjectId) {
  const rows = await (await services()).find({ dependencies: id }).toArray();
  return rows.map((r) => ({ id: r._id.toHexString(), name: r.name, openIncidents: 0 }));
}

export async function mttrFor(serviceId: ObjectId) {
  const rows = await (await incidents())
    .find({ serviceId, state: "resolved", resolvedAt: { $ne: null } })
    .project({ openedAt: 1, resolvedAt: 1 })
    .toArray();
  if (rows.length === 0) return { minutes: 0, resolved: 0 };
  const total = rows.reduce((sum, r) => sum + ((r.resolvedAt as Date).getTime() - r.openedAt.getTime()), 0);
  return { minutes: Math.round((total / rows.length / 60000) * 10) / 10, resolved: rows.length };
}
