import { useState, useEffect, useCallback } from "react";

/* ───────── Niveles y motor ───────── */
const LV = { facil: ["Fácil", 38], medio: ["Medio", 46], dificil: ["Difícil", 52], experto: ["Experto", 58] };
const peers = [...Array(81)].map((_, i) => {
  const r = (i / 9) | 0, c = i % 9, s = new Set();
  for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add((br + a) * 9 + bc + b);
  s.delete(i);
  return [...s];
});
const pc = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const cands = (g, i) => { let m = 0x3fe; for (const p of peers[i]) m &= ~(1 << g[p]); return m; };
function pick(g) {
  let b = -1, bm = 0, bc = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) { const m = cands(g, i), c = pc(m); if (c < bc) { bc = c; b = i; bm = m; if (c < 2) break; } }
  return [b, bm, bc];
}
function count(g, limit) {
  const [b, m, c] = pick(g);
  if (b < 0) return 1;
  if (!c) return 0;
  let n = 0;
  for (let d = 1; d < 10; d++) if ((m >> d) & 1) { g[b] = d; n += count(g, limit - n); if (n >= limit) break; }
  g[b] = 0;
  return n;
}
function fill(g) {
  const [b, m, c] = pick(g);
  if (b < 0) return true;
  if (!c) return false;
  const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (m >> d) & 1).sort(() => Math.random() - 0.5);
  for (const d of ds) { g[b] = d; if (fill(g)) return true; }
  g[b] = 0;
  return false;
}
function make(level) {
  const sol = Array(81).fill(0);
  fill(sol);
  const giv = sol.slice();
  const order = [...Array(81).keys()].sort(() => Math.random() - 0.5);
  let rem = LV[level][1];
  for (const i of order) {
    if (!rem) break;
    const v = giv[i];
    giv[i] = 0;
    if (count(giv.slice(), 2) === 1) rem--; else giv[i] = v;
  }
  return { sol, giv };
}

/* ───────── IndexedDB (sin dependencias) ───────── */
let dbp;
const openDB = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open("sudoku-db", 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("games", { keyPath: "id", autoIncrement: true }); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (store, mode, fn) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq?.result);
    t.onerror = () => rej(t.error);
  });
};
const kvGet = (k) => tx("kv", "readonly", (s) => s.get(k));
const kvSet = (k, v) => tx("kv", "readwrite", (s) => s.put(v, k));
const addGame = (g) => tx("games", "readwrite", (s) => s.add(g));
const allGames = () => tx("games", "readonly", (s) => s.getAll());
const clearGames = () => tx("games", "readwrite", (s) => s.clear());

/* ───────── Utilidades ───────── */
const fmt = (t) => (t == null ? "–" : `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`);
function calc(games) {
  const out = {};
  for (const k in LV) {
    const g = games.filter((x) => x.level === k), w = g.filter((x) => x.result === "ganada");
    out[k] = {
      played: g.length, won: w.length,
      best: w.length ? Math.min(...w.map((x) => x.t)) : null,
      avg: w.length ? Math.round(w.reduce((a, x) => a + x.t, 0) / w.length) : null,
      err: w.length ? (w.reduce((a, x) => a + x.err, 0) / w.length).toFixed(1) : "–",
    };
  }
  let cur = 0, best = 0;
  for (const x of [...games].sort((a, b) => a.date - b.date)) { if (x.result === "ganada") { cur++; best = Math.max(best, cur); } else cur = 0; }
  const wins = games.filter((x) => x.result === "ganada").length;
  return { out, cur, best, total: games.length, wins };
}

/* ───────── App ───────── */
export default function App() {
  const [S, setS] = useState(null);
  const [sel, setSel] = useState(-1);
  const [noteMode, setNoteMode] = useState(false);
  const [tab, setTab] = useState("play");
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(true);

  const newGame = useCallback((lv, prev) => {
    setBusy(true);
    setTimeout(async () => {
      if (prev && !prev.done && prev.moves > 0)
        await addGame({ level: prev.level, result: "abandonada", t: prev.t, err: prev.err, hints: prev.hints, date: Date.now() });
      const g = make(lv);
      setS({ ...g, v: g.giv.slice(), level: lv, notes: Array(81).fill(0), err: 0, hints: 0, t: 0, moves: 0, done: false, logged: false });
      setSel(-1);
      setBusy(false);
    }, 30);
  }, []);

  // carga inicial: retoma la partida guardada
  useEffect(() => {
    kvGet("current").then((c) => { if (c && !c.done) { setS(c); setBusy(false); } else newGame("facil"); }).catch(() => newGame("facil"));
  }, [newGame]);

  // cronómetro
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) setS((p) => (p && !p.done ? { ...p, t: p.t + 1 } : p)); }, 1000);
    return () => clearInterval(id);
  }, []);

  // guardado automático de la partida en curso
  useEffect(() => { if (S) kvSet("current", S).catch(() => {}); }, [S]);

  // registrar victoria
  useEffect(() => {
    if (S?.done && !S.logged) {
      addGame({ level: S.level, result: "ganada", t: S.t, err: S.err, hints: S.hints, date: Date.now() }).catch(() => {});
      setS((p) => ({ ...p, logged: true }));
    }
  }, [S]);

  // estadísticas al abrir la pestaña
  useEffect(() => { if (tab === "stats") allGames().then(setGames).catch(() => {}); }, [tab, S?.logged]);

  const put = (d) => {
    if (sel < 0 || !S || S.done || S.giv[sel]) return;
    setS((p) => {
      const v = p.v.slice(), n = p.notes.slice();
      let err = p.err;
      if (noteMode && d) { if (v[sel]) return p; n[sel] ^= 1 << d; }
      else {
        if (d && v[sel] === d) d = 0;
        v[sel] = d; n[sel] = 0;
        if (d && d !== p.sol[sel]) err++;
        if (d && d === p.sol[sel]) for (const q of peers[sel]) n[q] &= ~(1 << d);
      }
      return { ...p, v, notes: n, err, moves: p.moves + 1, done: v.every((x, i) => x === p.sol[i]) };
    });
  };
  const erase = () => put(0);
  const hint = () => {
    if (!S || S.done) return;
    let i = sel;
    if (i < 0 || S.v[i] === S.sol[i]) {
      const o = S.v.map((v, k) => (v !== S.sol[k] ? k : -1)).filter((k) => k >= 0);
      if (!o.length) return;
      i = o[(Math.random() * o.length) | 0];
    }
    setSel(i);
    setS((p) => {
      const v = p.v.slice(), g = p.giv.slice(), n = p.notes.slice();
      v[i] = g[i] = p.sol[i]; n[i] = 0;
      return { ...p, v, giv: g, notes: n, hints: p.hints + 1, t: p.t + 30, moves: p.moves + 1, done: v.every((x, k) => x === p.sol[k]) };
    });
  };
  const ask = (lv) => { if (!S || S.done || S.moves === 0 || confirm("¿Dejar esta partida y empezar otra? Se cuenta como abandonada.")) newGame(lv, S); };

  useEffect(() => {
    const h = (e) => {
      if (tab !== "play") return;
      if (/^[1-9]$/.test(e.key)) put(+e.key);
      else if (["Backspace", "Delete", "0"].includes(e.key)) erase();
      else if (e.key.toLowerCase() === "n") setNoteMode((m) => !m);
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        setSel((s) => {
          if (s < 0) return 40;
          const r = (s / 9) | 0, c = s % 9;
          return e.key === "ArrowUp" ? ((r + 8) % 9) * 9 + c : e.key === "ArrowDown" ? ((r + 1) % 9) * 9 + c : e.key === "ArrowLeft" ? r * 9 + ((c + 8) % 9) : r * 9 + ((c + 1) % 9);
        });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const st = calc(games);
  const sv = S && sel >= 0 ? S.v[sel] : 0;
  const pr = sel >= 0 ? peers[sel] : [];
  const cnt = Array(10).fill(0);
  S?.v.forEach((v) => cnt[v]++);

  return (
    <main className="sd">
      <style>{CSS}</style>
      <header>
        <h1>Sudoku</h1>
        <nav>
          <button aria-pressed={tab === "play"} onClick={() => setTab("play")}>Jugar</button>
          <button aria-pressed={tab === "stats"} onClick={() => setTab("stats")}>Estadísticas</button>
        </nav>
      </header>

      {tab === "play" && S && (
        <>
          <div className="levels">
            {Object.entries(LV).map(([k, v]) => (
              <button key={k} aria-pressed={S.level === k} onClick={() => ask(k)}>{v[0]}</button>
            ))}
          </div>
          <div className="stats"><span>{fmt(S.t)}</span><span>Errores: {S.err}</span><span>Pistas: {S.hints}</span></div>
          <div id="board" role="grid" aria-label="Tablero de sudoku" aria-busy={busy}>
            {S.v.map((v, i) => {
              const cls = ["c", S.giv[i] && "g", i === sel ? "s" : pr.includes(i) ? "p" : "", sv && v === sv && i !== sel ? "s2" : "", v && v !== S.sol[i] ? "e" : ""];
              return (
                <div key={i} role="gridcell" className={cls.filter(Boolean).join(" ")} onClick={() => setSel(i)}>
                  {v ? v : S.notes[i] ? (
                    <div className="n">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <span key={d}>{(S.notes[i] >> d) & 1 ? d : ""}</span>)}</div>
                  ) : ""}
                </div>
              );
            })}
          </div>
          <div className="pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button key={d} disabled={9 - cnt[d] <= 0} onClick={() => put(d)}>{d}<small>{9 - cnt[d] > 0 ? 9 - cnt[d] : ""}</small></button>
            ))}
          </div>
          <div className="acts">
            <button aria-pressed={noteMode} onClick={() => setNoteMode(!noteMode)}>Notas</button>
            <button onClick={erase}>Borrar</button>
            <button onClick={hint}>Pista</button>
            <button onClick={() => ask(S.level)}>Nuevo</button>
          </div>
          {busy && <p className="muted">Generando tablero…</p>}
        </>
      )}

      {tab === "stats" && (
        <section>
          <div className="cards">
            <div><b>{st.total}</b><span>Partidas</span></div>
            <div><b>{st.total ? Math.round((st.wins / st.total) * 100) : 0}%</b><span>Victorias</span></div>
            <div><b>{st.cur}</b><span>Racha</span></div>
            <div><b>{st.best}</b><span>Mejor racha</span></div>
          </div>
          <div className="tbl">
            <div className="row h"><span>Nivel</span><span>Ganadas</span><span>Mejor</span><span>Prom.</span><span>Err.</span></div>
            {Object.entries(LV).map(([k, v]) => (
              <div className="row" key={k}>
                <span>{v[0]}</span><span>{st.out[k].won}/{st.out[k].played}</span><span>{fmt(st.out[k].best)}</span><span>{fmt(st.out[k].avg)}</span><span>{st.out[k].err}</span>
              </div>
            ))}
          </div>
          <h2>Últimas partidas</h2>
          {games.length === 0 && <p className="muted">Todavía no jugaste ninguna partida.</p>}
          <ul className="hist">
            {[...games].sort((a, b) => b.date - a.date).slice(0, 10).map((g) => (
              <li key={g.id} className={g.result}>
                <span>{LV[g.level][0]}</span><span>{g.result}</span><span>{fmt(g.t)}</span><span>{new Date(g.date).toLocaleDateString("es-AR")}</span>
              </li>
            ))}
          </ul>
          <div className="acts two">
            <button onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(games, null, 2)], { type: "application/json" })); a.download = "sudoku-partidas.json"; a.click(); }}>Exportar JSON</button>
            <button onClick={() => confirm("¿Borrar todo el historial?") && clearGames().then(() => setGames([]))}>Borrar historial</button>
          </div>
        </section>
      )}

      {S?.done && tab === "play" && (
        <div className="win"><div>
          <h2>¡Resuelto!</h2>
          <p>{LV[S.level][0]} · {fmt(S.t)} · {S.err} errores · {S.hints} pistas</p>
          <button onClick={() => newGame(S.level, S)}>Jugar otro</button>
          <button className="ghost" onClick={() => setTab("stats")}>Ver estadísticas</button>
        </div></div>
      )}
      <footer className="foot">by Walter Castillo</footer>
    </main>
  );
}

const CSS = `
.sd{--bg:#e9eef5;--paper:#fbfcfe;--ink:#17263d;--mute:#6a7b93;--line:#c3cedd;--accent:#0e8a8c;--sel:#cfe9ea;--peer:#e6eff6;--same:#aedadb;--err:#c8372d;--errbg:#f8dcd9;--font:"Iowan Old Style",Georgia,serif;--ui:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
 font-family:var(--ui);color:var(--ink);width:min(100%,460px);margin:0 auto;padding:max(16px,env(safe-area-inset-top)) 12px 24px}
@media(prefers-color-scheme:dark){.sd{--bg:#0f1824;--paper:#162233;--ink:#e3ebf6;--mute:#8296b0;--line:#33445c;--accent:#3fc0c2;--sel:#1f4852;--peer:#1b2b40;--same:#27616a;--err:#ff7a70;--errbg:#4a2326}}
body{background:#e9eef5;margin:0}@media(prefers-color-scheme:dark){body{background:#0f1824}}
.sd *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.sd button{font:inherit;color:var(--ink);cursor:pointer}
.sd header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.sd h1{font:600 28px/1 var(--font);margin:0}.sd h2{font:600 18px var(--font);margin:20px 0 8px}
.sd nav{display:flex;gap:6px}
.sd nav button,.levels button,.acts button{padding:9px 12px;border:1px solid var(--line);background:var(--paper);border-radius:8px;font-size:14px}
[aria-pressed=true]{background:var(--accent)!important;border-color:var(--accent)!important;color:#fff!important}
.acts button[aria-pressed=true]{background:var(--ink)!important;border-color:var(--ink)!important;color:var(--paper)!important}
.levels{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
.stats{display:flex;justify-content:space-between;font-size:14px;color:var(--mute);margin-bottom:8px}
#board{display:grid;grid-template-columns:repeat(9,1fr);aspect-ratio:1;background:var(--paper);border:2px solid var(--ink);border-radius:4px}
.c{display:flex;align-items:center;justify-content:center;border:1px solid var(--line);font:500 clamp(20px,6.4vw,30px)/1 var(--font);color:var(--accent);cursor:pointer;user-select:none}
.c.g{color:var(--ink);font-weight:700}
.c:nth-child(9n+3),.c:nth-child(9n+6){border-right:2px solid var(--ink)}
.c:nth-child(n+19):nth-child(-n+27),.c:nth-child(n+46):nth-child(-n+54){border-bottom:2px solid var(--ink)}
.c.p{background:var(--peer)}.c.s2{background:var(--same)}.c.s{background:var(--sel)}.c.e{color:var(--err);background:var(--errbg)}
.n{display:grid;grid-template-columns:repeat(3,1fr);width:100%;height:100%;font:400 clamp(8px,2.3vw,11px)/1 var(--ui);color:var(--mute);text-align:center;align-content:space-evenly}
.pad{display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin:14px 0 10px}
.pad button{aspect-ratio:3/4;border:1px solid var(--line);background:var(--paper);border-radius:8px;font:500 clamp(18px,5.5vw,26px) var(--font);padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.pad small{font:11px var(--ui);color:var(--mute)}.pad button:disabled{opacity:.3;cursor:default}
.acts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.acts.two{grid-template-columns:1fr 1fr;margin-top:18px}
.muted{color:var(--mute);font-size:14px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cards div{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:12px 4px;text-align:center}
.cards b{display:block;font:600 24px var(--font)}.cards span{font-size:12px;color:var(--mute)}
.tbl{margin-top:14px;background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.row{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr .8fr;padding:10px 12px;font-size:14px;border-top:1px solid var(--line)}
.row.h{border:0;color:var(--mute);font-size:12px}
.hist{list-style:none;margin:0;padding:0}
.hist li{display:grid;grid-template-columns:1.2fr 1.2fr 1fr 1.3fr;padding:9px 12px;font-size:14px;border-bottom:1px solid var(--line)}
.hist li.abandonada{color:var(--mute)}
.win{position:fixed;inset:0;background:rgba(10,20,34,.6);display:flex;align-items:center;justify-content:center;padding:20px}
.win div{background:var(--paper);border-radius:14px;padding:26px;text-align:center;max-width:320px}
.win h2{font-size:26px;margin:0 0 8px}.win p{color:var(--mute)}
.win button{display:block;width:100%;margin-top:10px;padding:11px;border:0;background:var(--accent);color:#fff;border-radius:8px;font-size:16px}
.win .ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.foot{margin-top:28px;text-align:center;font-size:13px;color:var(--mute);letter-spacing:.02em}
.sd button:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
`;