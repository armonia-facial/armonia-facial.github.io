/* Lógica de la interfaz móvil. */
"use strict";
(function (A) {
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    }
    kids.forEach((c) => e.append(c));
    return e;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("armonia:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("armonia:" + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };
  const state = { res: null, layers: { ...A.OVERLAY_DEFAULTS }, isExample: true, pdfFile: null };

  // ---------------------------------------------------------------- navegación
  function show(view) {
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "v-" + view; });
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.v === view ? "page" : "false"));
    window.scrollTo({ top: 0 });
    if (view === "puntos") renderViewer();
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.v)));

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }
  function busy(msg) { $("#busy").hidden = !msg; if (msg) $("#busyMsg").textContent = msg; }

  // ---------------------------------------------------------------- carga de fotos
  $("#btnCam").addEventListener("click", () => $("#fileCam").click());
  $("#btnGal").addEventListener("click", () => $("#fileGal").click());
  for (const id of ["#fileCam", "#fileGal"]) {
    $(id).addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await runFile(f);
    });
  }

  async function runFile(file) {
    try {
      busy("Validando la imagen…");
      const img = await A.loadImageFile(file);
      await runImage(img, false);
    } catch (err) { fail(err); }
  }

  async function runImage(img, isExample) {
    try {
      busy("Cargando el motor de visión…");
      const t0 = performance.now();
      const res = await A.analyze(img, (m) => busy(m));
      const wait = Math.max(0, 500 - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      state.res = res; state.isExample = isExample;
      renderAll();
      busy(null);
      if (!isExample) toast(`Análisis completado: ${res.score.toFixed(1)} puntos.`);
    } catch (err) { fail(err); }
  }

  function fail(err) {
    busy(null);
    console.error(err);
    const title = err && err.title ? err.title : "No se pudo completar el análisis";
    const msg = err && err.message ? err.message : String(err);
    if (!state.res) {
      $("#tier").textContent = title;
      $("#tierComment").textContent = msg + " Revise la conexión a internet la primera vez (se descarga el motor de visión).";
    }
    toast(`${title}: ${msg}`);
  }

  // ---------------------------------------------------------------- resultados
  const STAR = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" fill="${on ? "var(--accent)" : "var(--surface-2)"}"/></svg>`;

  function renderAll() {
    const r = state.res, g = r.geometry;
    $("#srcBadge").textContent = state.isExample ? "Foto de ejemplo (astronauta, NASA)" : `Su foto · ${r.name}`;
    $("#gVal").textContent = r.score.toFixed(1);
    requestAnimationFrame(() => { $("#gArc").setAttribute("stroke-dasharray", `${(292.2 * r.score / 100).toFixed(1)} 389.6`); });
    $("#tier").textContent = r.tier.label;
    $("#stars").innerHTML = [0, 1, 2, 3, 4].map((k) => STAR(k < r.tier.stars)).join("");
    $("#stars").setAttribute("aria-label", `${r.tier.stars} de 5`);
    $("#tierComment").textContent = r.tier.comment;
    const wb = $("#warnBox");
    if (r.warnings.length) { wb.innerHTML = "<b>Advertencias de calidad</b><br>"; r.warnings.forEach((w) => wb.append("• " + w, el("br"))); wb.hidden = false; }
    else wb.hidden = true;
    const mini = A.renderView(r, { mesh: true, contours: true, keypoints: true, axis: true }, { side: 600 });
    $("#miniCanvas").getContext("2d").drawImage(mini, 0, 0);

    const list = $("#indList"); list.innerHTML = "";
    g.indicators.forEach((i, k) => {
      const det = i.errorKind === "relativo"
        ? `medido ${i.measured.toFixed(3)} · ideal ${i.spec.ideal.toFixed(3)} · error ${(i.error * 100).toFixed(1)} %`
        : `medido ${i.measured.toFixed(4)} · ideal ${i.spec.ideal.toFixed(1)} · σ ${i.spec.sigma}`;
      const bar = el("div", { class: "bar" }, el("i"));
      const b = el("button", { class: "ind", type: "button", "aria-label": `${i.spec.name}: ${i.score.toFixed(1)} puntos` },
        el("span", { class: "n", text: String(k + 1) }), el("span", { class: "name", text: i.spec.name }),
        el("span", { class: "s", text: i.score.toFixed(1) }), bar, el("span", { class: "det", text: det }));
      b.addEventListener("click", () => openSection({ sym_reflection: 6, sym_area: 7, fifths: 9 }[i.spec.key] || 8));
      list.append(b);
      setTimeout(() => { bar.firstChild.style.width = `${i.score.toFixed(1)}%`; }, 80 + 60 * k);
    });

    const det = r.detection;
    const stats = [
      ["Distancia interpupilar", `${g.iod.toFixed(1)} px`], ["Inclinación corregida", `${(g.rollRad * 180 / Math.PI).toFixed(2)}°`],
      ["Giro / cabeceo", det.yaw == null ? "—" : `${det.yaw.toFixed(1)}° / ${det.pitch.toFixed(1)}°`],
      ["Pares simétricos", String(g.pairErrors.length)], ["Tiempo de cálculo", `${r.elapsedMs.toFixed(0)} ms`],
      ["Huella de la imagen", r.imageHash ? r.imageHash.slice(0, 10) : "—"],
    ];
    $("#stats").innerHTML = "";
    stats.forEach(([k, v]) => $("#stats").append(el("div", { class: "stat" }, el("div", { class: "k", text: k }), el("div", { class: "v", text: v }))));

    renderDistances();
    renderSections();
    renderViewer();
  }

  // ---------------------------------------------------------------- visor
  const LAYERS = [["mesh", "Malla"], ["contours", "Contornos"], ["keypoints", "Puntos"], ["labels", "Nombres"], ["axis", "Eje de simetría"],
    ["symmetry", "Vectores de simetría"], ["thirds", "Tercios"], ["fifths", "Quintos"], ["measures", "Medidas"]];
  const chips = $("#chips");
  LAYERS.forEach(([k, label]) => {
    const c = el("button", { class: "chip", type: "button", "aria-pressed": String(!!state.layers[k]), text: label });
    c.addEventListener("click", () => { state.layers[k] = !state.layers[k]; c.setAttribute("aria-pressed", String(state.layers[k])); renderViewer(); });
    chips.append(c);
  });
  function renderViewer() {
    if (!state.res || $("#v-puntos").hidden) return;
    const after = A.renderView(state.res, state.layers, { side: 900 });
    const before = A.renderPlain(state.res, { side: 900 });
    $("#cvAfter").getContext("2d").drawImage(after, 0, 0);
    $("#cvBefore").getContext("2d").drawImage(before, 0, 0);
  }
  const viewer = $("#viewer");
  const setSplit = (clientX) => {
    const r = viewer.getBoundingClientRect();
    const p = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    viewer.style.setProperty("--split", p + "%");
  };
  let dragging = false;
  viewer.addEventListener("pointerdown", (e) => { dragging = true; viewer.setPointerCapture(e.pointerId); setSplit(e.clientX); });
  viewer.addEventListener("pointermove", (e) => { if (dragging) setSplit(e.clientX); });
  viewer.addEventListener("pointerup", () => { dragging = false; });
  viewer.addEventListener("pointercancel", () => { dragging = false; });

  function renderDistances() {
    const g = state.res.geometry, t = $("#distTable");
    t.innerHTML = "<thead><tr><th>Distancia</th><th>px</th><th>÷ DIP</th></tr></thead>";
    const tb = el("tbody");
    Object.entries(g.distances).forEach(([k, v]) => tb.append(el("tr", {}, el("td", { text: k }), el("td", { class: "r", text: v.toFixed(2) }), el("td", { class: "r", text: (v / g.iod).toFixed(4) }))));
    t.append(tb);
  }

  // ---------------------------------------------------------------- cálculos
  const isNum = (v) => /^[\s+\-−—]*[\d.,]+(\s*(%|px|px²|°))?$|^—$|^$/.test(String(v));
  function renderSections() {
    const host = $("#secs"); host.innerHTML = "";
    A.buildSections(state.res).forEach((s) => {
      const body = el("div", { class: "secbody" }, el("p", { class: "muted", text: s.text }));
      if (s.formulas.length) {
        const fx = el("div", { class: "formulas" });
        s.formulas.forEach((t) => {
          const f = A.RECURSOS.formulas[t];
          if (f) { const im = el("img", { src: f.src, alt: t, width: String(Math.round(f.w * 1.25)), height: String(Math.round(f.h * 1.25)) }); fx.append(im); }
          else fx.append(el("code", { text: t }));
        });
        body.append(fx);
      }
      if (s.rows.length) {
        const dl = el("dl", { class: "kv" });
        s.rows.forEach(([k, v]) => dl.append(el("dt", { text: k }), el("dd", { text: v })));
        body.append(dl);
      }
      s.tables.forEach((tb) => {
        const t = el("table");
        t.append(el("thead", {}, el("tr", {}, ...tb.headers.map((h) => el("th", { text: h })))));
        const b = el("tbody");
        tb.rows.forEach((row) => b.append(el("tr", row[0] === "TOTAL" ? { class: "total" } : {}, ...row.map((v, c) => el("td", c > 0 && isNum(v) ? { class: "r", text: v } : { text: v })))));
        t.append(b);
        body.append(el("div", { class: "tablewrap" }, t));
      });
      s.blocks.forEach((bk) => body.append(el("pre", { class: "block", text: bk })));
      const d = el("details", { class: "sec", id: "sec-" + s.number },
        el("summary", {}, el("span", { class: "n", text: String(s.number) }), el("span", { text: s.title })), body);
      host.append(d);
    });
  }
  function openSection(n) {
    show("calculos");
    const d = document.getElementById("sec-" + n);
    if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
  }

  // ---------------------------------------------------------------- informe
  const form = $("#repForm");
  const info = { ...A.REPORT_DEFAULTS, ...store.get("informe", {}) };
  A.REPORT_FIELDS.forEach(([k, label]) => {
    const id = "f-" + k;
    const inp = el("input", { id, name: k, type: "text", value: info[k] });
    inp.addEventListener("input", () => { info[k] = inp.value; store.set("informe", info); preview(); });
    form.append(el("div", { class: "field" + (k === "titulo" || k === "lema_anio" || k === "encabezado_trabajo" ? " wide" : "") }, el("label", { for: id, text: label }), inp));
  });
  function preview() { $("#repPreview").textContent = `En el encabezado aparecerá: «${A.nombreSinTitulos(info.docente) || "—"}»`; }
  preview();
  $("#btnDefaults").addEventListener("click", () => {
    Object.assign(info, A.REPORT_DEFAULTS); store.set("informe", info);
    A.REPORT_FIELDS.forEach(([k]) => { $("#f-" + k).value = info[k]; });
    preview();
  });
  $("#btnPdf").addEventListener("click", async () => {
    if (!state.res) { toast("Primero analice una fotografía."); return; }
    if (!window.jspdf) { toast("No se pudo cargar el generador de PDF; revise la conexión."); return; }
    if (!(info.autor || "").trim()) {
      toast("Escriba el autor(a) del informe.");
      const f = $("#f-autor"); f.focus(); f.scrollIntoView({ block: "center" });
      return;
    }
    try {
      busy("Generando el informe PDF…");
      await new Promise((r) => setTimeout(r, 30));
      const filled = {};
      A.REPORT_FIELDS.forEach(([k]) => { filled[k] = (info[k] || "").trim() || (k === "codigo" ? "" : A.REPORT_DEFAULTS[k]); });
      const views = {
        plain: A.renderPlain(state.res, { side: 700 }).toDataURL("image/jpeg", 0.9),
        annotated: A.renderView(state.res, { mesh: true, contours: true, keypoints: true, axis: true }, { side: 700 }).toDataURL("image/jpeg", 0.9),
      };
      const doc = A.buildPdf(state.res, filled, views);
      const stem = (state.res.name || "rostro").replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_");
      const d = new Date(), p = (n) => String(n).padStart(2, "0");
      const filename = `Informe_${stem}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.pdf`;
      busy(null);
      if (window.AndroidArmonia) { // APK: lo guarda Android en Descargas y lo abre
        const donde = window.AndroidArmonia.guardarPdf(filename, doc.output("datauristring").split(",")[1]);
        $("#btnShare").hidden = false;
        toast(donde ? `Informe guardado en ${donde}` : "No se pudo guardar el informe.");
        return;
      }
      doc.save(filename);
      state.pdfFile = new File([doc.output("blob")], filename, { type: "application/pdf" });
      const canShare = navigator.canShare && navigator.canShare({ files: [state.pdfFile] });
      $("#btnShare").hidden = !canShare;
      toast(canShare ? "Informe generado. También puede compartirlo." : "Informe generado.");
    } catch (err) { fail(err); }
  });
  $("#btnShare").addEventListener("click", async () => {
    if (window.AndroidArmonia) { window.AndroidArmonia.compartirPdf(); return; }
    if (!state.pdfFile) return;
    try { await navigator.share({ files: [state.pdfFile], title: "Informe de armonía facial" }); }
    catch (e) { if (e && e.name !== "AbortError") toast("No se pudo compartir el PDF."); }
  });
  const refs = [...new Set(A.INDICATORS.map((s) => s.reference))].sort().concat([
    "Lugaresi et al. (2019). MediaPipe: A Framework for Building Perception Pipelines.",
    "Kartynnik et al. (2019). Real-time Facial Surface Geometry from Monocular Video.",
    "Burden, R. & Faires, J. D. Análisis numérico."]);
  refs.forEach((r) => $("#refs").append(el("li", { text: r })));

  // ---------------------------------------------------------------- inicio
  $("#disc").textContent = A.DISCLAIMER.replace(/^La belleza es subjetiva y depende/, "Depende");
  $("#appIcon").src = A.RECURSOS.icono;
  // Modo sin conexión (solo en https o localhost): guarda la app, el motor y el modelo.
  if ("serviceWorker" in navigator && window.isSecureContext && !window.ARMONIA_SIN_SW) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  // Tarjeta «Instalar en el celular» (no aparece dentro del APK); el botón del APK solo si el archivo existe.
  if (!window.AndroidArmonia) {
    $("#installCard").hidden = false;
    fetch("ArmoniaFacial.apk", { method: "HEAD", cache: "no-store" })
      .then((r) => { if (r.ok) $("#apkRow").hidden = false; })
      .catch(() => {});
  }
  A.app = { state, runImage, show };
  // Abre con la foto de ejemplo ya analizada para mostrar qué hace la app.
  (async () => {
    try {
      const im = new Image();
      im.src = A.RECURSOS.ejemplo;
      await im.decode();
      const bmp = await createImageBitmap(im);
      await runImage(A.bitmapToCanvas(bmp, "astronauta.jpg"), true);
    } catch (err) { fail(err); }
  })();
})(window.Armonia = window.Armonia || {});
