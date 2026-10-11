import { useState, useMemo, useEffect } from "react";

/* =====================  Utilidades  ===================== */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["L","M","M","J","V","S","D"];
const METODOS = ["Efectivo", "Transferencia", "Otro"];
const FREQ = { mensual: "Mensual", quincenal: "Quincenal", semanal: "Semanal" };
const KEY = "control-pagos-v1";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const money = (n) => fmt.format(n || 0);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n) => Math.round(n * 100) / 100;
const num = (s) => parseFloat(String(s).replace(",", "."));
const sum = (arr, f) => round2(arr.reduce((a, x) => a + f(x), 0));

function addPeriods(start, k, freq) {
  const d = parse(start);
  if (freq === "semanal") { d.setDate(d.getDate() + 7 * k); return iso(d); }
  if (freq === "quincenal") { d.setDate(d.getDate() + 14 * k); return iso(d); }
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + k, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return iso(t);
}

/* Cálculo de cuotas.
   frances: cuota fija, interés sobre saldo  -> C = P·i / (1 − (1+i)^−n)
   simple : interés fijo sobre el capital   -> C = P·(1 + i·n) / n
   rate = tasa % por período (según la periodicidad elegida) */
function buildSchedule({ amount, rate, n, first, freq, method }) {
  const i = rate / 100;
  let cuota, total;
  if (method === "frances") {
    cuota = i === 0 ? amount / n : (amount * i) / (1 - Math.pow(1 + i, -n));
    total = cuota * n;
  } else {
    total = amount * (1 + i * n);
    cuota = total / n;
  }
  const rows = [];
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const monto = k === n - 1 ? round2(total - acc) : round2(cuota);
    acc += monto;
    rows.push({ n: k + 1, due: addPeriods(first, k, freq), amount: monto });
  }
  return { rows, cuota: round2(cuota), total: round2(total), interest: round2(total - amount) };
}

/* Cuotas "planas": una fila por cuota, con lo pagado, saldo y estado calculados */
function deriveCuotas(db) {
  const t = today();
  const clients = Object.fromEntries(db.clients.map((c) => [c.id, c]));
  const paid = {};
  db.payments.filter((p) => !p.voided).forEach((p) => {
    const k = p.loanId + ":" + p.n;
    paid[k] = (paid[k] || 0) + p.amount;
  });
  const out = [];
  db.loans.forEach((l) =>
    l.installments.forEach((it) => {
      const key = l.id + ":" + it.n;
      const pg = round2(paid[key] || 0);
      const saldo = round2(it.amount - pg);
      const status = saldo <= 0.004 ? "pagada" : it.due < t ? "vencida" : pg > 0 ? "parcial" : "pendiente";
      out.push({
        key, loanId: l.id, clientId: l.clientId, client: clients[l.clientId]?.name || "—",
        n: it.n, total: l.installments.length, due: it.due, amount: it.amount,
        paid: pg, saldo: Math.max(saldo, 0), status,
      });
    })
  );
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.client.localeCompare(b.client));
}

/* =====================  Datos y persistencia  ===================== */
function seed() {
  const t = today();
  const clients = [
    { id: "c1", name: "María Gómez" },
    { id: "c2", name: "Carlos Benítez" },
    { id: "c3", name: "Lucía Fernández" },
  ];
  const mk = (id, clientId, amount, rate, n, first) => ({
    id, clientId, amount, rate, freq: "mensual", method: "frances", first,
    installments: buildSchedule({ amount, rate, n, first, freq: "mensual", method: "frances" }).rows,
  });
  const loans = [
    mk("l1", "c1", 120000, 5, 6, addPeriods(t, -2, "mensual")),
    mk("l2", "c2", 60000, 4, 3, addPeriods(t, -1, "mensual")),
    mk("l3", "c3", 250000, 3.5, 12, addPeriods(t, 1, "semanal")),
  ];
  const pay = (loan, n, amount, method) => ({
    id: uid(), loanId: loan.id, n, amount: amount ?? loan.installments[n - 1].amount,
    date: loan.installments[n - 1].due, method,
  });
  const payments = [
    pay(loans[0], 1, null, "Transferencia"),
    pay(loans[0], 2, null, "Efectivo"),
    pay(loans[1], 1, round2(loans[1].installments[0].amount / 2), "Efectivo"),
  ];
  return { clients, loans, payments };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* sin almacenamiento */ }
  return seed();
}

/* =====================  Piezas reutilizables  ===================== */
const Badge = ({ s }) => <span className={`badge ${s}`}>{s}</span>;

function Stats({ items }) {
  return (
    <div className="cp-stats">
      {items.map(([label, value]) => (
        <div className="cp-stat" key={label}><b>{value}</b><span>{label}</span></div>
      ))}
    </div>
  );
}

function CuotaTable({ rows, empty = "No hay cuotas para mostrar.", action, expand }) {
  if (!rows.length) return <p className="sub">{empty}</p>;
  return (
    <div className="cp-tw">
      <table>
        <thead>
          <tr>
            <th>Cliente</th><th>Cuota</th><th>Vence</th>
            <th className="n">Monto</th><th className="n">Pagado</th><th className="n">Saldo</th>
            <th>Estado</th>{action && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <FragmentRow key={c.key} c={c} action={action} expand={expand} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="n">{money(sum(rows, (c) => c.amount))}</td>
            <td className="n">{money(sum(rows, (c) => c.paid))}</td>
            <td className="n">{money(sum(rows, (c) => c.saldo))}</td>
            <td colSpan={action ? 2 : 1}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FragmentRow({ c, action, expand }) {
  const extra = expand ? expand(c) : null;
  return (
    <>
      <tr>
        <td>{c.client}</td>
        <td>{c.n} de {c.total}</td>
        <td>{fmtDate(c.due)}</td>
        <td className="n">{money(c.amount)}</td>
        <td className="n">{money(c.paid)}</td>
        <td className="n">{money(c.saldo)}</td>
        <td><Badge s={c.status} /></td>
        {action && <td>{action(c)}</td>}
      </tr>
      {extra && <tr><td colSpan={8} style={{ background: "#F4F7F9" }}>{extra}</td></tr>}
    </>
  );
}

/* =====================  1. Crear pago  ===================== */
function CrearPago({ db, setDb }) {
  const blank = { cliente: "", importe: "", tasa: "", cuotas: "", primera: today(), freq: "mensual", method: "frances" };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMsg(""); };

  const amount = num(f.importe), rate = num(f.tasa), n = parseInt(f.cuotas, 10);
  const valid = f.cliente.trim() && amount > 0 && rate >= 0 && n >= 1 && n <= 360 && f.primera;
  const preview = useMemo(
    () => (valid ? buildSchedule({ amount, rate, n, first: f.primera, freq: f.freq, method: f.method }) : null),
    [valid, amount, rate, n, f.primera, f.freq, f.method]
  );

  const save = () => {
    const name = f.cliente.trim();
    let client = db.clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
    let clients = db.clients;
    if (!client) { client = { id: uid(), name }; clients = [...clients, client]; }
    const loan = {
      id: uid(), clientId: client.id, amount, rate, freq: f.freq, method: f.method,
      first: f.primera, installments: preview.rows,
    };
    setDb({ ...db, clients, loans: [...db.loans, loan] });
    setMsg(`Pago creado para ${client.name}: ${n} cuotas de ${money(preview.cuota)}.`);
    setF(blank);
  };

  return (
    <section>
      <h2>Crear pago</h2>
      <p className="sub">Ingresá el importe, la tasa y las cuotas. El valor de cada cuota se calcula solo.</p>
      <div className="cp-grid">
        <div className="cp-pan">
          <label>Cliente
            <input list="cp-clientes" value={f.cliente} onChange={set("cliente")} placeholder="Nombre y apellido" />
            <datalist id="cp-clientes">{db.clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </label>
          <div className="row2">
            <label>Importe ($)<input inputMode="decimal" value={f.importe} onChange={set("importe")} placeholder="100000" /></label>
            <label>Tasa por período (%)<input inputMode="decimal" value={f.tasa} onChange={set("tasa")} placeholder="5" /></label>
          </div>
          <div className="row2">
            <label>Cuotas<input inputMode="numeric" value={f.cuotas} onChange={set("cuotas")} placeholder="6" /></label>
            <label>Primera cuota<input type="date" value={f.primera} onChange={set("primera")} /></label>
          </div>
          <div className="row2">
            <label>Periodicidad
              <select value={f.freq} onChange={set("freq")}>
                {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Cálculo del interés
              <select value={f.method} onChange={set("method")}>
                <option value="frances">Sobre saldo (francés)</option>
                <option value="simple">Fijo sobre el capital</option>
              </select>
            </label>
          </div>
          <button className="cp-btn" disabled={!valid} onClick={save}>Guardar pago</button>
          {msg && <p className="ok-msg" role="status">{msg}</p>}
        </div>

        <div>
          {preview ? (
            <>
              <Stats items={[["Valor de cada cuota", money(preview.cuota)], ["Total a pagar", money(preview.total)], ["Interés total", money(preview.interest)]]} />
              <div className="cp-pan">
                <div className="cp-tw">
                  <table>
                    <thead><tr><th>Cuota</th><th>Vence</th><th className="n">Monto</th></tr></thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.n}><td>{r.n} de {n}</td><td>{fmtDate(r.due)}</td><td className="n">{money(r.amount)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="cp-pan"><p className="sub" style={{ margin: 0 }}>Completá los datos para ver el plan de cuotas antes de guardar.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}

/* =====================  2. Registrar pago  ===================== */
function PayForm({ c, onSave, onCancel }) {
  const [amount, setAmount] = useState(String(c.saldo));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(METODOS[0]);
  const [err, setErr] = useState("");

  const submit = () => {
    const a = num(amount);
    if (!(a > 0)) return setErr("Ingresá un monto mayor a cero.");
    if (a > c.saldo + 0.004) return setErr(`El monto supera el saldo de la cuota (${money(c.saldo)}).`);
    onSave({ id: uid(), loanId: c.loanId, n: c.n, amount: round2(a), date, method });
  };

  return (
    <div style={{ padding: "6px 0" }}>
      <div className="row3">
        <label>Monto cobrado<input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} /></label>
        <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Forma de pago
          <select value={method} onChange={(e) => setMethod(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
      </div>
      {err && <p className="err-msg" role="alert">{err}</p>}
      <button className="cp-btn sm" onClick={submit}>Confirmar pago</button>{" "}
      <button className="cp-btn sm ghost" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function Registrar({ cuotas, db, setDb }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState(null);
  const [open, setOpen] = useState(null);

  const prefix = `${ym.y}-${pad(ym.m + 1)}`;
  const month = cuotas.filter((c) => c.due.startsWith(prefix));
  const byDay = {};
  month.forEach((c) => { (byDay[c.due] = byDay[c.due] || []).push(c); });

  const move = (k) => {
    const d = new Date(ym.y, ym.m + k, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() }); setDay(null); setOpen(null);
  };
  const offset = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const dayStatus = (items) => items.some((c) => c.status === "vencida") ? "vencida" : items.some((c) => c.saldo > 0) ? "pendiente" : "pagada";
  const rows = day ? byDay[day] || [] : month;

  const register = (p) => { setDb({ ...db, payments: [...db.payments, p] }); setOpen(null); };

  return (
    <section>
      <h2>Registrar pago</h2>
      <p className="sub">Elegí un día del calendario o trabajá con todo el mes.</p>
      <Stats items={[
        [`Deuda de ${MESES[ym.m]}`, money(sum(month, (c) => c.saldo))],
        ["Cobrado del mes", money(sum(month, (c) => c.paid))],
        ["Vencido", money(sum(month.filter((c) => c.status === "vencida"), (c) => c.saldo))],
      ]} />
      <div className="cp-pan" style={{ marginBottom: 16 }}>
        <div className="cal-bar">
          <button className="cp-btn sm ghost" onClick={() => move(-1)} aria-label="Mes anterior">‹</button>
          <strong>{MESES[ym.m]} {ym.y}</strong>
          <button className="cp-btn sm ghost" onClick={() => move(1)} aria-label="Mes siguiente">›</button>
        </div>
        <div className="cal">
          {DIAS.map((d, i) => <div className="cal-h" key={i}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-d empty" />;
            const key = `${prefix}-${pad(d)}`;
            const items = byDay[key];
            const cls = ["cal-d", items ? "has " + dayStatus(items) : "", key === today() ? "hoy" : "", day === key ? "sel" : ""].join(" ");
            return (
              <button key={i} className={cls} disabled={!items} onClick={() => { setDay(day === key ? null : key); setOpen(null); }}>
                <span className="dn">{d}</span>
                {items && <small>{items.length} {items.length === 1 ? "cuota" : "cuotas"}</small>}
                {items && sum(items, (c) => c.saldo) > 0 && <small>${compact.format(sum(items, (c) => c.saldo))}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <h3>{day ? `Cuotas del ${fmtDate(day)}` : `Cuotas de ${MESES[ym.m]}`}</h3>
      <div className="cp-pan">
        <CuotaTable
          rows={rows}
          empty="No hay cuotas que venzan en este período."
          action={(c) => c.saldo > 0 && (
            <button className="cp-btn sm" onClick={() => setOpen(open === c.key ? null : c.key)}>Registrar pago</button>
          )}
          expand={(c) => open === c.key ? <PayForm c={c} onSave={register} onCancel={() => setOpen(null)} /> : null}
        />
      </div>
    </section>
  );
}

/* =====================  3. Consulta  ===================== */
const VISTAS = [
  ["cliente", "Por cliente"], ["mes", "Por mes"], ["deudas", "Deudas totales"],
  ["pagadas", "Cuotas pagadas"], ["impagas", "Cuotas impagas"], ["movs", "Movimientos"],
];

function Consulta({ cuotas, db, setDb }) {
  const [v, setV] = useState("cliente");
  const [cli, setCli] = useState(db.clients[0]?.id || "");
  const [mes, setMes] = useState(today().slice(0, 7));
  const [filtro, setFiltro] = useState("todas");

  const impagas = cuotas.filter((c) => c.saldo > 0);
  const nameOf = Object.fromEntries(db.clients.map((c) => [c.id, c.name]));
  const loanOf = Object.fromEntries(db.loans.map((l) => [l.id, l]));

  let body = null;
  if (v === "cliente") {
    const rows = cuotas.filter((c) => c.clientId === cli);
    body = (
      <>
        <label style={{ maxWidth: 320 }}>Cliente
          <select value={cli} onChange={(e) => setCli(e.target.value)}>
            {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Stats items={[["Saldo adeudado", money(sum(rows, (c) => c.saldo))], ["Total pagado", money(sum(rows, (c) => c.paid))], ["Cuotas impagas", rows.filter((c) => c.saldo > 0).length]]} />
        <CuotaTable rows={rows} />
      </>
    );
  } else if (v === "mes") {
    const rows = cuotas.filter((c) => c.due.startsWith(mes));
    body = (
      <>
        <label style={{ maxWidth: 220 }}>Mes<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        <Stats items={[["A cobrar en el mes", money(sum(rows, (c) => c.amount))], ["Cobrado", money(sum(rows, (c) => c.paid))], ["Pendiente", money(sum(rows, (c) => c.saldo))]]} />
        <CuotaTable rows={rows} empty="No hay cuotas con vencimiento en ese mes." />
      </>
    );
  } else if (v === "deudas") {
    const groups = db.clients.map((c) => {
      const r = impagas.filter((x) => x.clientId === c.id);
      return { c, n: r.length, venc: sum(r.filter((x) => x.status === "vencida"), (x) => x.saldo), saldo: sum(r, (x) => x.saldo) };
    }).filter((g) => g.saldo > 0).sort((a, b) => b.saldo - a.saldo);
    body = (
      <>
        <Stats items={[["Deuda total", money(sum(impagas, (c) => c.saldo))], ["Vencido", money(sum(impagas.filter((c) => c.status === "vencida"), (c) => c.saldo))], ["Clientes con deuda", groups.length]]} />
        {groups.length ? (
          <div className="cp-tw"><table>
            <thead><tr><th>Cliente</th><th className="n">Cuotas impagas</th><th className="n">Vencido</th><th className="n">Saldo total</th></tr></thead>
            <tbody>{groups.map((g) => (
              <tr key={g.c.id}><td>{g.c.name}</td><td className="n">{g.n}</td><td className="n">{money(g.venc)}</td><td className="n">{money(g.saldo)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="sub">No hay deudas pendientes.</p>}
      </>
    );
  } else if (v === "pagadas") {
    body = <CuotaTable rows={cuotas.filter((c) => c.status === "pagada")} empty="Todavía no hay cuotas pagadas." />;
  } else if (v === "impagas") {
    const rows = impagas.filter((c) => filtro === "todas" || (filtro === "vencidas" ? c.status === "vencida" : c.status !== "vencida"));
    body = (
      <>
        <label style={{ maxWidth: 220 }}>Mostrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todas">Todas</option><option value="vencidas">Solo vencidas</option><option value="aldia">Todavía no vencidas</option>
          </select>
        </label>
        <CuotaTable rows={rows} empty="No hay cuotas impagas con ese filtro." />
      </>
    );
  } else {
    const movs = [...db.payments].reverse();
    const toggle = (id) => setDb({ ...db, payments: db.payments.map((p) => p.id === id ? { ...p, voided: !p.voided } : p) });
    body = movs.length ? (
      <div className="cp-tw"><table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Cuota</th><th>Forma</th><th className="n">Monto</th><th></th></tr></thead>
        <tbody>{movs.map((p) => {
          const l = loanOf[p.loanId];
          return (
            <tr key={p.id} style={p.voided ? { opacity: 0.5, textDecoration: "line-through" } : null}>
              <td>{fmtDate(p.date)}</td><td>{l ? nameOf[l.clientId] : "—"}</td>
              <td>{p.n}{l ? ` de ${l.installments.length}` : ""}</td><td>{p.method}</td>
              <td className="n">{money(p.amount)}</td>
              <td style={{ textDecoration: "none" }}><button className="cp-btn sm ghost" onClick={() => toggle(p.id)}>{p.voided ? "Restaurar" : "Anular"}</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    ) : <p className="sub">Todavía no se registraron pagos.</p>;
  }

  return (
    <section>
      <h2>Consulta</h2>
      <div className="cp-tabs" role="tablist">
        {VISTAS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={v === k} onClick={() => setV(k)}>{t}</button>
        ))}
      </div>
      <div className="cp-pan">{body}</div>
    </section>
  );
}

/* =====================  App  ===================== */
export default function ControlPagos() {
  const [db, setDb] = useState(load);
  const [tab, setTab] = useState("crear");
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento */ } }, [db]);
  const cuotas = useMemo(() => deriveCuotas(db), [db]);

  const tabs = [["crear", "Crear pago"], ["registrar", "Registrar pago"], ["consulta", "Consulta"]];
  return (
    <div className="cp">
      <style>{css}</style>
      <header className="cp-top">
        <h1>Sistema de control de pagos</h1>
        <nav className="cp-nav">
          {tabs.map(([k, t]) => (
            <button key={k} aria-current={tab === k} onClick={() => setTab(k)}>{t}</button>
          ))}
        </nav>
      </header>
      <main className="cp-main">
        {tab === "crear" && <CrearPago db={db} setDb={setDb} />}
        {tab === "registrar" && <Registrar cuotas={cuotas} db={db} setDb={setDb} />}
        {tab === "consulta" && <Consulta cuotas={cuotas} db={db} setDb={setDb} />}
        <p className="foot">
          Demo con datos de ejemplo guardados en este navegador.{" "}
          <button className="link" onClick={() => setDb(seed())}>Restablecer datos de ejemplo</button>
        </p>
      </main>
    </div>
  );
}

/* =====================  Estilos  ===================== */
const css = `
@import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap");
.cp{--bg:#E8EDF1;--ink:#0F2233;--mut:#5B6B7A;--line:#C9D3DB;--acc:#0B6E6E;--bad:#B42318;--ok:#1E7A46;--warn:#8A5A00;
font-family:"Instrument Sans","Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;font-size:15px;line-height:1.45}
.cp *{box-sizing:border-box}
.cp-top{background:var(--ink);color:#fff;padding:14px 20px;display:flex;flex-wrap:wrap;gap:10px 28px;align-items:center}
.cp-top h1{font-size:18px;font-weight:600;margin:0}
.cp-nav{display:flex;gap:4px;flex-wrap:wrap}
.cp-nav button{background:transparent;color:#B9C7D3;border:0;padding:8px 14px;border-radius:6px;font:inherit;cursor:pointer}
.cp-nav button[aria-current=true]{background:#fff;color:var(--ink);font-weight:600}
.cp-main{max-width:1100px;margin:0 auto;padding:22px 16px 40px}
.cp h2{font-size:24px;margin:0 0 4px;font-weight:600}
.cp h3{font-size:16px;margin:0 0 8px;font-weight:600}
.cp .sub{color:var(--mut);margin:0 0 18px}
.cp-grid{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:18px;align-items:start}
@media(max-width:820px){.cp-grid{grid-template-columns:1fr}}
.cp-pan{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px}
.cp label{display:block;margin-bottom:12px;font-size:13px;color:var(--mut)}
.cp input,.cp select{display:block;width:100%;margin-top:4px;padding:9px 10px;border:1px solid var(--line);border-radius:6px;font:inherit;color:var(--ink);background:#fff}
.cp input:focus-visible,.cp select:focus-visible,.cp button:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.row3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.cp-btn{background:var(--acc);color:#fff;border:1px solid var(--acc);border-radius:6px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
.cp-btn:disabled{opacity:.45;cursor:not-allowed}
.cp-btn.ghost{background:transparent;color:var(--acc)}
.cp-btn.sm{padding:5px 10px;font-size:13px}
.ok-msg{color:var(--ok);margin:12px 0 0}.err-msg{color:var(--bad);margin:0 0 8px}
.cp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.cp-stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.cp-stat b{display:block;font-size:20px;font-variant-numeric:tabular-nums}
.cp-stat span{font-size:12.5px;color:var(--mut)}
.cp-tw{overflow-x:auto}
.cp table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.cp th,.cp td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.cp th{font-size:12.5px;color:var(--mut);font-weight:600}
.cp td.n,.cp th.n{text-align:right}
.cp tfoot td{font-weight:600;border-bottom:0}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600}
.badge.pagada{background:#DDF1E5;color:var(--ok)}.badge.vencida{background:#FADBD8;color:var(--bad)}
.badge.pendiente{background:#F3E8C8;color:var(--warn)}.badge.parcial{background:#D9E8F5;color:#1F5A8C}
.cal-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-h{font-size:12px;color:var(--mut);text-align:center;padding:4px 0}
.cal-d{min-height:66px;border:1px solid var(--line);border-left-width:4px;border-radius:6px;background:#fff;padding:5px 6px;text-align:left;font:inherit;color:var(--ink);display:flex;flex-direction:column;gap:2px;cursor:default}
.cal-d.has{cursor:pointer}
.cal-d.empty{background:transparent;border-color:transparent}
.cal-d.vencida{border-left-color:var(--bad)}.cal-d.pendiente{border-left-color:#D4A017}.cal-d.pagada{border-left-color:var(--ok)}
.cal-d.sel{outline:2px solid var(--ink)}
.cal-d.hoy .dn{background:var(--ink);color:#fff}
.dn{font-size:12px;font-weight:600;width:22px;height:22px;border-radius:50%;display:grid;place-items:center}
.cal-d small{font-size:11px;color:var(--mut);line-height:1.2}
@media(max-width:560px){.cal-d{min-height:52px;padding:3px}.cal-d small{font-size:10px}}
.cp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}
.cp-tabs button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:99px;padding:6px 14px;font:inherit;cursor:pointer}
.cp-tabs button[aria-selected=true]{background:var(--ink);color:#fff;border-color:var(--ink)}
.foot{margin-top:28px;font-size:13px;color:var(--mut)}
.link{background:none;border:0;color:var(--acc);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
`;
