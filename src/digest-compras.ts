/**
 * Shared digest builder for Pedidos Extraordinarios.
 * Used by:
 *  - scripts/digest-compras.ts  (manual / scheduled run from local Task Scheduler)
 *  - api/index.ts               (Vercel cron + admin "Enviar resumen ahora" button)
 *
 * Pure-ish: takes a Supabase client + sender, returns a structured result so
 * callers can decide how to log / report success.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from './email.js';

interface PedidoRow {
  id: string;
  Vn_Cve_Vendedor: string;
  Sc_Cve_Sucursal: string | null;
  Cl_Cve_Cliente: string | null;
  Pr_Cve_Producto: string | null;
  lead_id: string;
  producto_descripcion: string;
  cantidad: number;
  valor_estimado: number;
  justificacion: string | null;
  estado: string;
  created_at: string;
  vendedor: { Vn_Descripcion: string | null } | null;
  sucursales: { Sc_Descripcion: string | null } | null;
  productos: { Pv_Cve_Proveedor: string | null } | null;
  leads: { clientes: { Cl_Razon_Social: string | null; Cl_Descripcion: string | null } | null } | null;
}

interface ComprasUser {
  Vn_Cve_Vendedor: string;
  Vn_Email: string | null;
  Vn_Descripcion: string | null;
}

export interface DigestResult {
  pedidoCount: number;
  recipientCount: number;
  sentTo: string[];
  failedTo: { email: string; error: string }[];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const daysAgo = (iso: string): number => {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24)));
};

const moneyMx = (n: number): string =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

async function fetchActivePedidos(supabase: SupabaseClient): Promise<PedidoRow[]> {
  const { data, error } = await supabase
    .from('pedidos_extraordinarios')
    .select(`
      id, Vn_Cve_Vendedor, Sc_Cve_Sucursal, Cl_Cve_Cliente, Pr_Cve_Producto, lead_id,
      producto_descripcion, cantidad, valor_estimado, justificacion, estado, created_at,
      vendedor:Vn_Cve_Vendedor(Vn_Descripcion),
      sucursales(Sc_Descripcion),
      productos(Pv_Cve_Proveedor),
      leads(clientes(Cl_Razon_Social, Cl_Descripcion))
    `)
    .in('estado', ['solicitado', 'aprobado'])
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[digest] fetch pedidos failed:', error.message);
    return [];
  }
  return (data || []) as unknown as PedidoRow[];
}

async function fetchComprasUsers(supabase: SupabaseClient): Promise<ComprasUser[]> {
  const { data, error } = await supabase
    .from('vendedores')
    .select('Vn_Cve_Vendedor, Vn_Email, Vn_Descripcion')
    .eq('Vn_Perfil', 'Compras')
    .eq('Es_Cve_Estado', 'AC');
  if (error) {
    console.error('[digest] fetch compras users failed:', error.message);
    return [];
  }
  return (data || []) as ComprasUser[];
}

function buildHtml(pedidos: PedidoRow[], generatedAt: Date): string {
  type Group = Map<string, PedidoRow[]>;
  const bySucursal = new Map<string, Group>();
  let totalValor = 0;

  for (const p of pedidos) {
    totalValor += Number(p.valor_estimado) || 0;
    const sucursalName = p.sucursales?.Sc_Descripcion?.trim() || 'Sin sucursal';
    const proveedor = (p.productos?.Pv_Cve_Proveedor || 'Sin proveedor').toString().trim();
    let sucBucket = bySucursal.get(sucursalName);
    if (!sucBucket) { sucBucket = new Map(); bySucursal.set(sucursalName, sucBucket); }
    const provBucket = sucBucket.get(proveedor) || [];
    provBucket.push(p);
    sucBucket.set(proveedor, provBucket);
  }

  const sucursalNames = [...bySucursal.keys()].sort();
  const fechaStr = generatedAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

  const head = `
    <h2 style="font-family:Arial,sans-serif;color:#141456;margin:0 0 4px 0">Pedidos Extraordinarios — Resumen</h2>
    <p style="font-family:Arial,sans-serif;color:#475569;font-size:13px;margin:0 0 16px 0">
      Generado el ${escapeHtml(fechaStr)} · ${pedidos.length} pedido(s) activo(s) · Valor total estimado: <strong>${escapeHtml(moneyMx(totalValor))}</strong>
    </p>
  `;

  if (pedidos.length === 0) {
    return `<div style="font-family:Arial,sans-serif">${head}<p>No hay pedidos extraordinarios activos en este momento.</p></div>`;
  }

  const sections = sucursalNames.map((suc) => {
    const provGroups = bySucursal.get(suc)!;
    const provIds = [...provGroups.keys()].sort();
    const sucCount = [...provGroups.values()].reduce((acc, arr) => acc + arr.length, 0);

    const provBlocks = provIds.map((prov) => {
      const rows = provGroups.get(prov)!;
      const provLabel = prov === 'Sin proveedor' ? 'Sin proveedor' : `Proveedor ${prov}`;
      const tableRows = rows.map((p) => {
        const vendedor = p.vendedor?.Vn_Descripcion?.trim() || p.Vn_Cve_Vendedor;
        const sucursalRow = p.sucursales?.Sc_Descripcion?.trim() || 'Sin sucursal';
        const cliente = p.leads?.clientes?.Cl_Razon_Social?.trim()
          || p.leads?.clientes?.Cl_Descripcion?.trim()
          || '—';
        const productoCode = p.Pr_Cve_Producto || '(libre)';
        const days = daysAgo(p.created_at);
        const estadoBadge = p.estado === 'aprobado'
          ? `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#d1fae5;color:#065f46;font-size:10px">Aprobado</span>`
          : `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#fef3c7;color:#92400e;font-size:10px">Solicitado</span>`;
        const justificacion = p.justificacion?.trim()
          ? `<div style="color:#64748b;font-size:11px;font-style:italic;margin-top:4px">${escapeHtml(p.justificacion.trim())}</div>`
          : '';
        return `
          <tr style="border-top:1px solid #e2e8f0">
            <td style="padding:8px 6px;font-size:12px;vertical-align:top">
              <div style="font-weight:600;color:#0f172a">${escapeHtml(p.producto_descripcion)}</div>
              <div style="color:#94a3b8;font-size:10px;font-family:monospace">${escapeHtml(productoCode)}</div>
              ${justificacion}
            </td>
            <td style="padding:8px 6px;font-size:12px;text-align:right;vertical-align:top">${p.cantidad}</td>
            <td style="padding:8px 6px;font-size:12px;text-align:right;vertical-align:top;font-family:monospace">${escapeHtml(moneyMx(Number(p.valor_estimado) || 0))}</td>
            <td style="padding:8px 6px;font-size:12px;vertical-align:top">
              <div>${escapeHtml(vendedor)}</div>
              <div style="color:#94a3b8;font-size:10px">${escapeHtml(sucursalRow)}</div>
            </td>
            <td style="padding:8px 6px;font-size:12px;vertical-align:top">${escapeHtml(cliente)}</td>
            <td style="padding:8px 6px;font-size:12px;text-align:right;vertical-align:top">${days}d</td>
            <td style="padding:8px 6px;font-size:12px;vertical-align:top">${estadoBadge}</td>
          </tr>`;
      }).join('');

      return `
        <div style="margin:16px 0">
          <h4 style="font-family:Arial,sans-serif;color:#334155;margin:0 0 6px 0;font-size:13px">${escapeHtml(provLabel)} <span style="color:#94a3b8;font-weight:normal">· ${rows.length} pedido(s)</span></h4>
          <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;border:1px solid #e2e8f0">
            <thead style="background:#f8fafc">
              <tr>
                <th style="padding:6px;text-align:left;font-size:11px;color:#475569">Producto</th>
                <th style="padding:6px;text-align:right;font-size:11px;color:#475569">Cant.</th>
                <th style="padding:6px;text-align:right;font-size:11px;color:#475569">Valor</th>
                <th style="padding:6px;text-align:left;font-size:11px;color:#475569">Vendedor</th>
                <th style="padding:6px;text-align:left;font-size:11px;color:#475569">Cliente</th>
                <th style="padding:6px;text-align:right;font-size:11px;color:#475569">Días</th>
                <th style="padding:6px;text-align:left;font-size:11px;color:#475569">Estado</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <section style="margin:24px 0">
        <h3 style="font-family:Arial,sans-serif;color:#141456;border-bottom:2px solid #141456;padding-bottom:6px;margin:0 0 4px 0">
          ${escapeHtml(suc)} <span style="color:#64748b;font-weight:normal;font-size:14px">· ${sucCount} pedido(s)</span>
        </h3>
        ${provBlocks}
      </section>
    `;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:920px;margin:0 auto;padding:24px;background:#fff">
      ${head}
      ${sections}
      <p style="font-family:Arial,sans-serif;color:#94a3b8;font-size:11px;margin-top:24px">
        Para resolver un pedido, ingresa al CRM y márcalo como aprobado, rechazado o pedido.
      </p>
    </div>
  `;
}

function buildText(pedidos: PedidoRow[], generatedAt: Date): string {
  const lines: string[] = [];
  lines.push(`Pedidos Extraordinarios — Resumen (${generatedAt.toLocaleString('es-MX')})`);
  lines.push(`${pedidos.length} pedido(s) activo(s)`);
  lines.push('');
  if (pedidos.length === 0) {
    lines.push('No hay pedidos extraordinarios activos en este momento.');
    return lines.join('\n');
  }
  const bySucursal = new Map<string, Map<string, PedidoRow[]>>();
  for (const p of pedidos) {
    const suc = p.sucursales?.Sc_Descripcion?.trim() || 'Sin sucursal';
    const prov = (p.productos?.Pv_Cve_Proveedor || 'Sin proveedor').toString().trim();
    let sb = bySucursal.get(suc); if (!sb) { sb = new Map(); bySucursal.set(suc, sb); }
    const list = sb.get(prov) || []; list.push(p); sb.set(prov, list);
  }
  for (const [suc, provs] of [...bySucursal.entries()].sort()) {
    lines.push(`=== ${suc} ===`);
    for (const [prov, rows] of [...provs.entries()].sort()) {
      lines.push(`  Proveedor ${prov}:`);
      for (const p of rows) {
        const vendedor = p.vendedor?.Vn_Descripcion?.trim() || p.Vn_Cve_Vendedor;
        const cliente = p.leads?.clientes?.Cl_Razon_Social?.trim()
          || p.leads?.clientes?.Cl_Descripcion?.trim()
          || '—';
        lines.push(`    [${p.estado}] ${p.producto_descripcion} — ${p.cantidad} u · ${moneyMx(Number(p.valor_estimado) || 0)} · ${vendedor} → ${cliente} · ${daysAgo(p.created_at)}d`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build and send the digest. Returns a structured result so callers can log
 * or report. Throws only on truly unrecoverable errors (missing SMTP config).
 */
export async function runDigest(supabase: SupabaseClient): Promise<DigestResult> {
  const pedidos = await fetchActivePedidos(supabase);
  const compras = await fetchComprasUsers(supabase);
  const recipients = compras.map((c) => c.Vn_Email).filter((e): e is string => !!e);

  const result: DigestResult = {
    pedidoCount: pedidos.length,
    recipientCount: recipients.length,
    sentTo: [],
    failedTo: [],
  };

  if (recipients.length === 0) return result;

  const generatedAt = new Date();
  const html = buildHtml(pedidos, generatedAt);
  const text = buildText(pedidos, generatedAt);
  const subject = pedidos.length === 0
    ? 'Pedidos Extraordinarios — Sin actividad'
    : `Pedidos Extraordinarios — ${pedidos.length} pendiente(s) de atender`;

  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html, text });
      result.sentTo.push(to);
    } catch (err: any) {
      result.failedTo.push({ email: to, error: err?.message || String(err) });
    }
  }
  return result;
}
