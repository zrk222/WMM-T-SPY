import { ObjectId } from "mongodb";
import { alertDeliveries, alertRules } from "./collections";
import type { IncidentDoc } from "./collections";

const RANK: Record<string, number> = { sev1: 1, sev2: 2, sev3: 3, sev4: 4 };

/** Fire matching webhook rules for an incident. Never throws. */
export async function deliverAlert(incident: IncidentDoc, ownerId: ObjectId) {
  try {
    const rules = await (await alertRules())
      .find({ ownerId, enabled: true, webhookUrl: { $ne: null } } as never)
      .toArray();
    const matching = rules.filter(
      (r) => RANK[incident.severity] <= RANK[r.severityMin] && (!r.serviceId || r.serviceId.equals(incident.serviceId)),
    );

    await Promise.all(
      matching.map(async (r) => {
        const payload = {
          event: "incident.opened",
          rule: r.name,
          incident: {
            id: incident._id.toHexString(),
            title: incident.title,
            severity: incident.severity,
            state: incident.state,
            serviceId: incident.serviceId.toHexString(),
            openedAt: incident.openedAt,
          },
        };
        let status: number | null = null;
        let error: string | null = null;
        try {
          const res = await fetch(r.webhookUrl!, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(3000),
          });
          status = res.status;
        } catch (e) {
          error = e instanceof Error ? e.message : "request failed";
        }
        await (await alertDeliveries()).insertOne({
          _id: new ObjectId(),
          ownerId,
          ruleId: r._id,
          incidentId: incident._id,
          url: r.webhookUrl!,
          status,
          error,
          at: new Date(),
        });
      }),
    );
  } catch {
    /* delivery must never break the write */
  }
}
