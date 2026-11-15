"use client";

import { useState } from "react";
import Link from "next/link";
import { BulkBar } from "./bulk-bar";

type Row = {
  id: string;
  severity: string;
  state: string;
  title: string;
  serviceName: string;
  openedAt: string;
};

export function IncidentTable({ rows }: { rows: Row[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <BulkBar selected={sel} />
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="select all"
                checked={sel.length > 0 && sel.length === rows.length}
                onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])}
              />
            </th>
            <th>Sev</th>
            <th>State</th>
            <th>Incident</th>
            <th>Service</th>
            <th>Opened</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <input type="checkbox" aria-label={`select ${i.title}`} checked={sel.includes(i.id)} onChange={() => toggle(i.id)} />
              </td>
              <td>
                <span className={`pill ${i.severity}`}>{i.severity}</span>
              </td>
              <td>
                <span className={`pill ${i.state}`}>{i.state}</span>
              </td>
              <td>
                <Link href={`/incidents/${i.id}`}>{i.title}</Link>
              </td>
              <td className="muted">{i.serviceName}</td>
              <td className="muted">{i.openedAt}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
