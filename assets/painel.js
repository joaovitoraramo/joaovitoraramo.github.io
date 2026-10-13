/* Painel Réplica do Tempo. Os dados chegam como script publicado pelo Mac a cada coleta (sem servidor e sem tokens aqui). */
(() => {
  "use strict";
  const DADOS = window.PAINEL_DADOS || "https://pub-e8b3e055aa0b46f1bf64b419e1a5e11f.r2.dev/painel/replicadotempo.js";
  const REDES = [["youtube", "YouTube"], ["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["kwai", "Kwai"]];
  const NOME = Object.fromEntries(REDES);
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = new Intl.NumberFormat("pt-BR");
  const curto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const cor = (e, id) => { e.style.setProperty("--c", `var(--${id})`); return e; };
  const hm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = t => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const dur = s => s >= 3600 ? (s / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " h" : s >= 60 ? Math.round(s / 60) + " min" : Math.round(s) + " s";

  let atual = null, visiveis = new Set(REDES.map(r => r[0])), anterior = {};

  // ---------- números que sobem ----------
  function conta(node, alvo, chave) {
    const de = anterior[chave] ?? 0; anterior[chave] = alvo;
    if (calmo || de === alvo) { node.textContent = nf.format(alvo); return; }
    const t0 = performance.now(), ms = 1100;
    const passo = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 4); node.textContent = nf.format(Math.round(de + (alvo - de) * e)); if (p < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }

  // ---------- curva suave que nunca passa do ponto (interpolação monótona) ----------
  function caminho(pts) {
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
    const n = pts.length, dx = [], m = [], t = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1)); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }
  const teto = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p; return 10 * p; };

  // ganho da rede (ou do total) nas últimas 24 h, ou desde a primeira coleta se o histórico for mais curto
  function ganho(pontos, id) {
    if (pontos.length < 2) return null;
    const val = p => id ? (p[id] || 0) : REDES.reduce((s, [r]) => s + (p[r] || 0), 0);
    const fim = pontos.at(-1), limite = new Date(fim.ts).getTime() - 864e5;
    const base = pontos.find(p => new Date(p.ts).getTime() >= limite) || pontos[0];
    const curto24 = new Date(pontos[0].ts).getTime() > limite;
    return { n: val(fim) - val(base), rotulo: curto24 ? `desde ${hm(base.ts)}` : "em 24 h" };
  }

  // ---------- topo ----------
  function estado() {
    if (!atual || !atual.atualizado_em) return;
    const min = Math.max(0, Math.round((Date.now() - new Date(atual.atualizado_em).getTime()) / 6e4));
    const txt = min < 1 ? "Atualizado agora" : min < 60 ? `Atualizado há ${min} min` : min < 1440 ? `Última coleta há ${Math.floor(min / 60)} h ${min % 60} min` : `Última coleta em ${dia(atual.atualizado_em)}`;
    $("estadoTxt").textContent = txt; $("estado").classList.toggle("velho", min > 75);
  }

  function topo(d) {
    const totais = d.totais || {}, soma = Object.values(totais).reduce((a, b) => a + b, 0);
    conta($("total"), soma, "total");
    const selos = $("selos"); selos.replaceChildren();
    const g = ganho(d.pontos || []);
    if (g && g.n > 0) { const s = el("span", "selo sobe-cor"); s.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 10l4-4 3 3 3-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; s.append(`+${nf.format(g.n)} ${g.rotulo}`); selos.append(s); }
    const seg = Object.values(d.seguidores || {}).reduce((a, b) => a + b, 0);
    selos.append(el("span", "selo", `${nf.format(seg)} ${seg === 1 ? "seguidor" : "seguidores"} somados`));
    selos.append(el("span", "selo", `${(d.videos || []).length} vídeos no ar`));

    // anel de participação
    const anel = $("anel"), C = 2 * Math.PI * 50, ativos = REDES.filter(([id]) => totais[id] > 0);
    let acum = 0;
    for (const [id] of REDES) {
      let c = anel.querySelector(`[data-r="${id}"]`);
      if (!c) { c = svg("circle", { cx: 60, cy: 60, r: 50, "data-r": id, "stroke-dasharray": `0 ${C}` }); c.style.stroke = `var(--${id})`; anel.append(c); }
      const fr = soma ? (totais[id] || 0) / soma : 0, folga = ativos.length > 1 && fr > 0 ? 1.6 : 0;
      setTimeout(() => { c.setAttribute("stroke-dasharray", `${Math.max(0, fr * C - folga)} ${C}`); c.setAttribute("stroke-dashoffset", `${-acumAt}`); }, 60);
      const acumAt = acum * C; acum += fr;
    }
    const lider = ativos.slice().sort((a, b) => totais[b[0]] - totais[a[0]])[0];
    $("lider").textContent = lider ? Math.round(100 * totais[lider[0]] / soma) + "%" : "–";
    $("liderNome").textContent = lider ? lider[1] : "sem dados";
    const leg = $("legenda"); leg.replaceChildren();
    for (const [id, nome] of ativos.sort((a, b) => totais[b[0]] - totais[a[0]])) {
      const l = cor(el("div"), id); l.append(el("i"), el("span", null, nome), el("b", null, Math.round(100 * totais[id] / soma) + "%")); leg.append(l);
    }
  }

  // ---------- fichas por rede ----------
  function fichasRedes(d, primeira) {
    const box = $("redes"), totais = d.totais || {}, pontos = d.pontos || [], seg = d.seguidores || {}, tempo = d.tempo_total_s || {};
    box.replaceChildren();
    REDES.forEach(([id, nome], i) => {
      const tem = id in totais, c = cor(el("article", "vidro rede" + (tem ? "" : " vazia") + (primeira ? " sobe" : "")), id);
      c.style.setProperty("--i", 3 + i * 0.6);
      const cab = el("div", "cab"), n = el("span"); n.append(el("i"), nome); cab.append(n); c.append(cab);
      if (!tem) { c.append(el("div", "valor", "Sem dados ainda"), el("div", "meta", "Nada publicado ou coletado nesta rede.")); box.append(c); return; }
      const v = el("div", "valor num"); c.append(v); conta(v, totais[id], "r:" + id);
      const g = ganho(pontos, id), m1 = el("div", "meta");
      if (g && g.n > 0) m1.append(el("span", "ganho", `+${nf.format(g.n)}`), ` ${g.rotulo}`); else m1.textContent = "views";
      c.append(m1);
      const extras = [];
      if (id in seg) extras.push(`${nf.format(seg[id])} ${seg[id] === 1 ? "seguidor" : "seguidores"}`);
      if (tempo[id] > 0) extras.push(`${dur(tempo[id])} assistidos`);
      c.append(el("div", "meta", extras.join(" · ")));
      // mini-curva
      const W = 240, H = 62, s = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" });
      const serie = pontos.map(p => p[id] || 0);
      if (serie.length > 1) {
        const mx = Math.max(...serie), mn = Math.min(...serie), amp = (mx - mn) || 1;
        const pts = serie.map((y, k) => [k * W / (serie.length - 1), 8 + (H - 16) * (1 - (y - mn) / amp)]);
        const gid = `sg-${id}`, defs = svg("defs"), gr = svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
        const a = svg("stop", { offset: 0, "stop-opacity": .38 }), b = svg("stop", { offset: 1, "stop-opacity": 0 }); a.style.stopColor = b.style.stopColor = `var(--${id})`;
        gr.append(a, b); defs.append(gr); s.append(defs);
        const dpath = caminho(pts);
        s.append(svg("path", { d: `${dpath}L${W},${H}L0,${H}Z`, fill: `url(#${gid})` }));
        const ln = svg("path", { d: dpath, fill: "none", "stroke-width": 2.4, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }); ln.style.stroke = `var(--${id})`;
        s.append(ln);
      }
      c.append(s); box.append(c);
    });
  }

  // ---------- curva grande ----------
  function grafico(d) {
    const box = $("grafico"), dica = $("dica"), pontos = d.pontos || [];
    box.querySelector("svg")?.remove();
    const ativos = REDES.filter(([id]) => pontos.some(p => p[id] != null));
    const fichas = $("fichas"); fichas.replaceChildren();
    for (const [id, nome] of ativos) {
      const b = cor(el("button", "ficha"), id); b.type = "button"; b.setAttribute("aria-pressed", visiveis.has(id)); b.append(el("i"), nome);
      b.addEventListener("click", () => { visiveis.has(id) ? visiveis.delete(id) : visiveis.add(id); grafico(atual); });
      fichas.append(b);
    }
    $("curvaNota").textContent = pontos.length < 2 ? "A curva se forma a partir da segunda coleta. Volte em meia hora." : "Total de views a cada coleta. Passe o dedo ou o mouse pela curva para ver o momento exato.";
    if (!pontos.length) return;
    const estreito = box.clientWidth < 620;                       // no celular o desenho é mais alto para a curva respirar
    const W = estreito ? 560 : 1000, H = estreito ? 400 : 380, L = estreito ? 44 : 52, R = 18, T = 18, B = 34;
    const ts = pontos.map(p => new Date(p.ts).getTime()), t0 = ts[0], t1 = ts.at(-1), vao = (t1 - t0) || 1;
    const mostra = ativos.filter(([id]) => visiveis.has(id));
    const max = teto(Math.max(1, ...mostra.flatMap(([id]) => pontos.map(p => p[id] || 0))));
    const x = t => pontos.length === 1 ? (L + W - R) / 2 : L + (t - t0) / vao * (W - L - R), y = v => T + (H - T - B) * (1 - v / max);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Views de cada rede ao longo das coletas" });
    const defs = svg("defs"); s.append(defs);
    for (let k = 0; k <= 4; k++) {
      const v = max * k / 4;
      s.append(svg("line", { class: "grade", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      const tx = svg("text", { x: L - 10, y: y(v) + 4, "text-anchor": "end" }); tx.textContent = curto.format(v); s.append(tx);
    }
    const longo = vao > 36 * 36e5, nt = Math.min(estreito ? 4 : 6, pontos.length);
    for (let k = 0; k < nt; k++) {
      const t = nt === 1 ? t0 : t0 + vao * k / (nt - 1);
      const tx = svg("text", { x: x(t), y: H - 8, "text-anchor": k === 0 && nt > 1 ? "start" : k === nt - 1 && nt > 1 ? "end" : "middle" });
      tx.textContent = longo ? `${dia(t)} ${hm(t)}` : hm(t); s.append(tx);
    }
    const marcas = {};
    mostra.forEach(([id], i) => {
      const pts = pontos.map((p, k) => [x(ts[k]), y(p[id] || 0)]), dp = caminho(pts), gid = `g-${id}`;
      const gr = svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }), a = svg("stop", { offset: 0, "stop-opacity": .26 }), b = svg("stop", { offset: 1, "stop-opacity": 0 });
      a.style.stopColor = b.style.stopColor = `var(--${id})`; gr.append(a, b); defs.append(gr);
      if (pts.length > 1) {
        s.append(svg("path", { class: "area", d: `${dp}L${pts.at(-1)[0]},${H - B}L${pts[0][0]},${H - B}Z`, fill: `url(#${gid})` }));
        const ln = cor(svg("path", { class: "curva", d: dp, pathLength: 1 }), id); ln.style.stroke = `var(--${id})`; ln.style.animationDelay = `${i * 140}ms`; s.append(ln);
      }
      const fim = svg("circle", { class: "fim", cx: pts.at(-1)[0], cy: pts.at(-1)[1], r: 5 }); fim.style.fill = `var(--${id})`; fim.style.stroke = "var(--bg)"; fim.style.strokeWidth = 2.5; s.append(fim);
      const mk = svg("circle", { class: "marca-pt", r: 5.5 }); mk.style.fill = "var(--bg)"; mk.style.stroke = `var(--${id})`; mk.style.strokeWidth = 3; s.append(mk); marcas[id] = mk;
    });
    const mira = svg("line", { class: "mira", y1: T, y2: H - B }); s.append(mira);
    box.prepend(s);

    const aponta = ev => {
      const r = s.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
      let k = 0, melhor = Infinity; ts.forEach((t, i) => { const dd = Math.abs(x(t) - px); if (dd < melhor) { melhor = dd; k = i; } });
      const cx = x(ts[k]); mira.setAttribute("x1", cx); mira.setAttribute("x2", cx);
      dica.replaceChildren(el("b", null, `${dia(ts[k])} · ${hm(ts[k])}`));
      mostra.slice().sort((a, b) => (pontos[k][b[0]] || 0) - (pontos[k][a[0]] || 0)).forEach(([id, nome]) => {
        const v = pontos[k][id] || 0; marcas[id].setAttribute("cx", cx); marcas[id].setAttribute("cy", y(v));
        const l = cor(el("div"), id); l.append(el("i"), el("span", null, nome), el("span", null, nf.format(v))); dica.append(l);
      });
      const bw = box.clientWidth, dw = dica.offsetWidth, sx = cx / W * r.width;
      const left = sx + 16 + dw > bw ? sx - dw - 16 : sx + 16;
      dica.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, (ev.clientY - r.top) - dica.offsetHeight - 14)}px)`;
      box.classList.add("ativo");
    };
    s.addEventListener("pointermove", aponta); s.addEventListener("pointerdown", aponta);
    s.addEventListener("pointerleave", () => box.classList.remove("ativo"));
  }

  // ---------- ranking de vídeos ----------
  function videos(d) {
    const box = $("videos"), vids = d.videos || [];
    if (!vids.length) return;
    box.replaceChildren();
    const topoV = Math.max(1, ...vids.map(v => v.total));
    vids.forEach((v, i) => {
      const c = el("article", "video");
      c.append(el("div", "pos", String(i + 1).padStart(2, "0")));
      const meio = el("div"); meio.append(el("h3", null, v.titulo || v.chave), el("span", "tipo", (v.tipo === "long" ? "VÍDEO LONGO" : "SHORT") + (v.run_id ? ` · ${v.run_id.slice(8, 10)}/${v.run_id.slice(5, 7)}` : ""))); c.append(meio);
      const soma = el("div", "soma num", nf.format(v.total)); soma.append(el("small", null, "views")); c.append(soma);
      const pilha = el("div", "pilha"), chips = el("div", "chips");
      for (const [id, nome] of REDES) {
        const p = v.plataformas[id]; if (!p) continue;
        const seg = cor(el("i"), id); seg.title = `${nome}: ${nf.format(p.views)}`; pilha.append(seg);
        setTimeout(() => { seg.style.width = (100 * p.views / topoV).toFixed(2) + "%"; }, 80 + i * 60);
        const link = /^https:\/\//.test(p.url || ""), ch = cor(el(link ? "a" : "span", "chip"), id);
        if (link) { ch.href = p.url; ch.target = "_blank"; ch.rel = "noopener"; }
        ch.append(el("i"), nome, el("b", null, nf.format(p.views)));
        if (p.tempo_medio_s > 0) ch.append(`· ${dur(p.tempo_medio_s)} em média`);
        chips.append(ch);
      }
      c.append(pilha, chips); box.append(c);
    });
  }

  function render(d) {
    const primeira = !atual, mudou = !atual || atual.atualizado_em !== d.atualizado_em;
    atual = d; estado();
    if (!mudou) return;
    topo(d); fichasRedes(d, primeira); grafico(d); videos(d);
    const cp = d.curtidas_perfil || {};
    $("rodape").textContent = "Dados coletados a cada 30 minutos direto das plataformas" + (cp.kwai != null ? `. No Kwai o perfil soma ${nf.format(cp.kwai)} curtidas.` : ".");
  }

  function busca() {
    const s = document.createElement("script");
    s.src = `${DADOS}?t=${Date.now()}`; s.async = true;
    s.onload = () => s.remove();
    s.onerror = () => { s.remove(); if (!atual) $("estadoTxt").textContent = "Não foi possível buscar os dados. Nova tentativa em 1 minuto."; };
    document.head.append(s);
  }
  let larg = innerWidth, espera;
  addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(() => { if (atual && Math.abs(innerWidth - larg) > 40) { larg = innerWidth; grafico(atual); } }, 180); });
  // ---------- dados cifrados: a senha vira chave no navegador e nunca sai dele ----------
  const b64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  const guarda = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
  let chave = null, chaveSal = null, pendente = null;
  async function deriva(senha, env) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: b64(env.sal), iterations: env.iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }
  async function abre(env, k) {
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(env.iv) }, k, b64(env.dados));
    return JSON.parse(new TextDecoder().decode(claro));
  }
  function tranca(mostra) { $("tranca").hidden = !mostra; $("conteudo").hidden = mostra; $("sair").hidden = mostra || !chave; if (mostra) setTimeout(() => $("senha").focus(), 50); }
  async function recebe(d) {
    if (!d || !d.cifrado) { tranca(false); render(d); return; }
    pendente = d;
    try {
      if (!chave || chaveSal !== d.sal) {
        const salva = guarda.get("painel-senha");
        if (!salva) { tranca(true); return; }
        chave = await deriva(salva, d); chaveSal = d.sal;
      }
      const dados = await abre(d, chave);
      tranca(false); render(dados);
    } catch { chave = null; guarda.del("painel-senha"); tranca(true); }
  }
  $("cofre").addEventListener("submit", async ev => {
    ev.preventDefault();
    if (!pendente) return;
    const senha = $("senha").value, bt = $("abrir"); bt.disabled = true; $("trancaErro").hidden = true;
    try {
      const k = await deriva(senha, pendente), dados = await abre(pendente, k);
      chave = k; chaveSal = pendente.sal;
      if ($("lembrar").checked) guarda.set("painel-senha", senha);
      $("senha").value = ""; tranca(false); render(dados);
    } catch {
      $("trancaErro").hidden = false; const c = $("cofre"); c.classList.remove("treme"); void c.offsetWidth; c.classList.add("treme"); $("senha").select();
    } finally { bt.disabled = false; }
  });
  $("sair").addEventListener("click", () => { chave = null; atual = null; anterior = {}; guarda.del("painel-senha"); tranca(true); });
  window.__painel = recebe;
  busca(); setInterval(busca, 60_000); setInterval(estado, 20_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) busca(); });
})();
