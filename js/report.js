/* Informe PDF en el teléfono (jsPDF) con la carátula y el encabezado del modelo UNIFSLB.
   Medidas en puntos tipográficos, iguales a las de armonia/report/pdf_report.py. */
"use strict";
(function (A) {
  const PAGE_W = 595.28, PAGE_H = 841.89;
  const LEFT = 85, RIGHT = 55, TOP_BODY = 110, BOTTOM = 62;
  const CW = PAGE_W - LEFT - RIGHT;
  const GRAY = [127, 127, 127], GRID = [191, 191, 191], ZEBRA = [242, 242, 242], INK2 = [64, 64, 64];
  const HEADER_TOP = 19.1, HEADER_H = 58.6;
  // Cuatro recuadros grises (x, ancho) y, a la derecha, el escudo de Ingeniería Civil (x, lado)
  const BOXES = [[56.6, 156.0], [217.8, 70.7], [293.7, 79.0], [378.0, 106.1]];
  const LOGO2 = [495.0, 45.2];

  // Las fuentes estándar del PDF (Times) usan WinAnsi: se traducen los símbolos que no tiene.
  const MAP = { "σ": "sigma", "μ": "mu", "θ": "theta", "φ": "phi", "Σ": "Suma ", "Δ": "Delta ", "√": "raíz", "≈": "~",
    "−": "-", "→": "->", "←": "<-", "↔": "<->", "‖": "||", "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5",
    "ᵢ": "i", "̄": "", "̂": "", "∂": "d", "∇": "Lap", "★": "*", "☆": "o" };
  const clean = (s) => String(s).replace(/[σμθφΣΔ√≈−→←↔‖₀-₅ᵢ̄̂∂∇★☆]/g, (c) => MAP[c] ?? c);

  function headerAndNumber(doc, info, page) {
    doc.setFillColor(...GRAY);
    BOXES.forEach(([x, w]) => doc.rect(x, HEADER_TOP, w, HEADER_H, "F"));
    doc.setTextColor(255, 255, 255);
    // Recuadro 1: escudo + universidad
    const [x1, w1] = BOXES[0], logo = 38;
    if (A.RECURSOS && A.RECURSOS.logo) doc.addImage(A.RECURSOS.logo, "PNG", x1 + 2.5, HEADER_TOP + (HEADER_H - logo) / 2, logo, logo);
    doc.setFont("helvetica", "bold");
    const lineas = A.UNIVERSIDAD_ENCABEZADO.map(clean), tw = w1 - logo - 6;
    doc.setFontSize(1);
    const fs1 = Math.min(8, (tw - 2) / Math.max(...lineas.map((t) => doc.getTextWidth(t))));
    doc.setFontSize(fs1);
    centeredBlock(doc, lineas, x1 + logo + 4, tw, fs1 * 1.32, fs1);
    // Escudo de la Escuela de Ingeniería Civil, a la derecha
    if (A.RECURSOS && A.RECURSOS.logo2) doc.addImage(A.RECURSOS.logo2, "PNG", LOGO2[0], HEADER_TOP + (HEADER_H - LOGO2[1]) / 2, LOGO2[1], LOGO2[1]);
    // Recuadros 2–4
    const texts = [[A.nombreSinTitulos(info.docente), 8], [info.encabezado_trabajo.toUpperCase(), 6.6], [info.lema_anio.toUpperCase(), 6.6]];
    texts.forEach(([t, size], k) => {
      const [x, w] = BOXES[k + 1];
      doc.setFont("times", "bold");
      let fs = size, lines;
      for (;;) { doc.setFontSize(fs); lines = doc.splitTextToSize(clean(t), w - 8); if (lines.length <= 5 || fs <= 5.5) break; fs -= 0.25; }
      centeredBlock(doc, lines, x, w, fs * 1.22, fs);
    });
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(1); doc.line(56.6, 97.3, 540.2, 97.3);
    doc.setTextColor(...INK2); doc.setFont("times", "normal"); doc.setFontSize(9.5);
    doc.text(String(page), PAGE_W - RIGHT, PAGE_H - 32, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  function centeredBlock(doc, lines, x, w, leading, size) {
    const block = leading * lines.length;
    let y = HEADER_TOP + (HEADER_H - block) / 2 + size * 0.82;
    lines.forEach((ln) => { doc.text(ln, x + w / 2, y, { align: "center" }); y += leading; });
  }

  function starPath(doc, cx, cy, R, filled) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? R : R / 2.3, a = (-90 + 36 * i) * Math.PI / 180;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.setFillColor(...(filled ? [40, 40, 40] : [255, 255, 255])); doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.6);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], "FD", true);
  }

  A.buildPdf = function (res, info, views) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    doc.setProperties({ title: "Informe de análisis de armonía facial", author: info.autor, subject: info.titulo });
    let page = 1, y = 0;

    // ---------------------------------------------------------------- carátula
    const center = (t, size, style, yy) => { doc.setFont("times", style); doc.setFontSize(size); doc.text(clean(t), PAGE_W / 2, yy, { align: "center" }); };
    y = 62 + 6 + 16;
    A.UNIVERSIDAD_CARATULA.forEach((t) => { center(t, 16, "bold", y); y += 21; });
    y += 16 - 5;
    doc.addImage(A.RECURSOS.logo, "PNG", PAGE_W / 2 - 63, y, 126, 126);
    y += 126 + 26 + 13;
    center(A.FACULTAD, 13, "bold", y); y += 19; center(A.ESCUELA, 13, "bold", y);
    y += 40 + 19; center(info.titulo.toUpperCase(), 13, "bold", y);
    y += 26 + 18; center(info.subtitulo, 14, "bold", y);
    const autor = info.codigo.trim() ? `${info.autor} (${info.codigo})` : info.autor;
    y += 34 + 17; center("Autor(a):", 11, "bold", y); y += 17; center(autor, 11, "bold", y);
    y += 30 + 17; center("Profesor(a):", 11, "bold", y); y += 17; center(info.docente, 11, "bold", y);
    y += 30 + 17; center(info.lugar, 11, "bold", y); y += 17; center(info.anio, 11, "bold", y);

    // ---------------------------------------------------------------- utilidades de flujo
    const newPage = () => { doc.addPage(); page++; headerAndNumber(doc, info, page); y = TOP_BODY; };
    const ensure = (h) => { if (y + h > PAGE_H - BOTTOM) newPage(); };
    const para = (text, { size = 11, style = "normal", lead = 14.5, align = "justify", color = [0, 0, 0], after = 5 } = {}) => {
      doc.setFont("times", style); doc.setFontSize(size); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(clean(text), CW);
      lines.forEach((ln, i) => {
        ensure(lead);
        const last = i === lines.length - 1;
        doc.text(ln, LEFT, y + size * 0.8, align === "justify" && !last ? { align: "justify", maxWidth: CW } : {});
        y += lead;
      });
      y += after; doc.setTextColor(0, 0, 0);
    };
    const heading = (t, size = 12) => { ensure(40); y += 6; para(t, { size, style: "bold", align: "left", lead: size + 3.5, after: 4 }); };
    const table = (headers, rows, fr, { boldLast = false } = {}) => {
      const n = headers.length;
      if (!fr) {
        const wts = headers.map((h, c) => Math.min(42, Math.max(7, Math.max(String(h).length, ...rows.map((r) => String(r[c]).length)))));
        const s = wts.reduce((a, b) => a + b, 0); fr = wts.map((v) => v / s);
      }
      const ws = fr.map((f) => f * CW);
      const isNum = (v) => /^[\s+\-−—]*[\d.,]+(\s*(%|px|px²|°))?$|^—$|^$/.test(String(v));
      const drawRow = (cells, kind) => {
        doc.setFontSize(9);
        doc.setFont("times", kind === "head" || kind === "bold" ? "bold" : "normal");
        const wrapped = cells.map((c, i) => doc.splitTextToSize(clean(c), ws[i] - 8));
        const hh = Math.max(...wrapped.map((l) => l.length)) * 11 + 6;
        if (kind !== "head" && y + hh > PAGE_H - BOTTOM) { newPage(); drawRow(headers, "head"); doc.setFont("times", kind === "bold" ? "bold" : "normal"); }
        let x = LEFT;
        wrapped.forEach((lines, i) => {
          if (kind === "head") doc.setFillColor(...GRAY); else doc.setFillColor(...(kind === "zebra" ? ZEBRA : [255, 255, 255]));
          doc.setDrawColor(...GRID); doc.setLineWidth(0.4); doc.rect(x, y, ws[i], hh, "FD");
          doc.setTextColor(...(kind === "head" ? [255, 255, 255] : [0, 0, 0]));
          const right = kind !== "head" && i > 0 && isNum(cells[i]);
          lines.forEach((ln, j) => doc.text(ln, right ? x + ws[i] - 4 : x + 4, y + 3 + 8.3 + j * 11, right ? { align: "right" } : {}));
          x += ws[i];
        });
        doc.setTextColor(0, 0, 0);
        y += hh;
      };
      ensure(40); drawRow(headers, "head");
      rows.forEach((r, k) => drawRow(r, boldLast && k === rows.length - 1 ? "bold" : (k % 2 ? "zebra" : "plain")));
      y += 6;
    };
    const box = (drawInner, h, bg = ZEBRA) => {
      ensure(h);
      doc.setFillColor(...bg); doc.rect(LEFT, y, CW, h, "F");
      doc.setFillColor(...GRAY); doc.rect(LEFT, y, 3, h, "F");
      drawInner(y); y += h + 6;
    };

    // ---------------------------------------------------------------- cuerpo
    newPage();
    doc.setFont("times", "bold"); doc.setFontSize(15);
    doc.text("INFORME DE ANÁLISIS DE ARMONÍA FACIAL", PAGE_W / 2, y + 13, { align: "center" }); y += 29;
    para("Análisis geométrico de una fotografía del rostro mediante detección de puntos faciales (MediaPipe) y métodos numéricos: distancias euclidianas, rotación matricial, mínimos cuadrados con eliminación de Gauss, reflexión de Householder, fórmula de Gauss para áreas, Newton-Raphson y puntuación gaussiana. Procesado en el teléfono.");

    heading("1. DATOS DE LA FOTOGRAFÍA ANALIZADA");
    const [w0, h0] = res.originalSize;
    const fecha = res.timestamp.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    table(["Dato", "Valor", "Dato", "Valor"], [
      ["Archivo", res.name, "Fecha", fecha],
      ["Resolución", `${w0} × ${h0} px`, "Tiempo de cálculo", `${res.elapsedMs.toFixed(0)} ms`],
      ["Huella SHA-256", res.imageHash ? res.imageHash.slice(0, 24) + "…" : "—", "Rostros detectados", String(res.detection.numFaces)],
    ], [0.17, 0.40, 0.22, 0.21]);

    heading("2. RESULTADO DEL ANÁLISIS");
    const imgW = 139, scoreW = CW - 2 * (imgW + 11);
    ensure(imgW + 30);
    doc.addImage(views.plain, "JPEG", LEFT + 2, y, imgW, imgW);
    doc.addImage(views.annotated, "JPEG", LEFT + imgW + 13, y, imgW, imgW);
    const sx = LEFT + 2 * (imgW + 11) + 4, sw = scoreW - 4;
    doc.setFillColor(...ZEBRA); doc.setDrawColor(...GRID); doc.rect(sx, y, sw, imgW, "FD");
    doc.setFont("times", "normal"); doc.setFontSize(10.5);
    doc.text("Índice de armonía geométrica", sx + sw / 2, y + 20, { align: "center" });
    doc.setFont("times", "bold"); doc.setFontSize(34);
    doc.text(res.score.toFixed(1), sx + sw / 2, y + 60, { align: "center" });
    doc.setFont("times", "normal"); doc.setFontSize(9); doc.setTextColor(...INK2);
    doc.text("de 100 puntos", sx + sw / 2, y + 73, { align: "center" }); doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold"); doc.setFontSize(10.5);
    doc.splitTextToSize(res.tier.label, sw - 8).forEach((ln, i) => doc.text(ln, sx + sw / 2, y + 92 + i * 12, { align: "center" }));
    for (let k = 0; k < 5; k++) starPath(doc, sx + sw / 2 - 40 + k * 20, y + 122, 6.5, k < res.tier.stars);
    doc.setFont("times", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK2);
    doc.text("Fotografía original (recorte)", LEFT + 2 + imgW / 2, y + imgW + 12, { align: "center" });
    doc.text("Puntos faciales y eje de simetría", LEFT + imgW + 13 + imgW / 2, y + imgW + 12, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += imgW + 24;

    doc.setFont("times", "normal"); doc.setFontSize(11);
    const disc = doc.splitTextToSize(clean("Aviso importante. " + A.DISCLAIMER), CW - 20);
    box((yy) => {
      disc.forEach((ln, i) => {
        if (i === 0) {
          doc.setFont("times", "bold"); doc.text("Aviso importante.", LEFT + 10, yy + 16);
          const wB = doc.getTextWidth("Aviso importante. ");
          doc.setFont("times", "normal"); doc.text(ln.replace("Aviso importante. ", ""), LEFT + 10 + wB, yy + 16);
        } else doc.text(ln, LEFT + 10, yy + 16 + i * 14.5, i < disc.length - 1 ? { align: "justify", maxWidth: CW - 20 } : {});
      });
    }, disc.length * 14.5 + 12);
    if (res.warnings.length) {
      para("Advertencias de calidad:", { style: "bold", align: "left", after: 2 });
      res.warnings.forEach((w) => para("• " + w, { align: "left", after: 2 }));
    }

    heading("3. INDICADORES GEOMÉTRICOS");
    const g = res.geometry;
    const rows = g.indicators.map((i, k) => [`${k + 1}. ${i.spec.name}`, i.measured.toFixed(4), i.spec.ideal.toFixed(4),
      i.errorKind === "relativo" ? `${(i.error * 100).toFixed(2)} %` : i.error.toFixed(4), String(i.spec.sigma),
      i.score.toFixed(2), i.spec.weight.toFixed(2), i.contribution.toFixed(2)]);
    rows.push(["TOTAL (media ponderada)", "", "", "", "", "", "1.00", res.score.toFixed(2)]);
    table(["Indicador", "Medido", "Ideal", "Error", "Tol.", "Puntos", "Peso", "w·s"], rows, [0.37, 0.09, 0.08, 0.10, 0.06, 0.10, 0.08, 0.12], { boldLast: true });
    para("Error relativo E = |r - r*| / r* para los cocientes; error absoluto para la simetría por reflexión (en unidades de la distancia interpupilar) y para el coeficiente de variación. Puntuación s = 100·exp(-½(E/sigma)²). Nota final S = Suma w·s.", { size: 9, lead: 11.5, color: INK2 });

    // ---------------------------------------------------------------- procedimiento
    ensure(260);
    heading("4. PROCEDIMIENTO MATEMÁTICO PASO A PASO");
    para("Cada apartado muestra la fórmula aplicada y los valores reales obtenidos para esta fotografía. Todos los cálculos son deterministas (sin números aleatorios).");
    for (const s of A.buildSections(res)) {
      ensure(120);
      heading(`4.${s.number}. ${s.title}`, 11.5);
      para(s.text);
      const imgs = s.formulas.map((t) => A.RECURSOS.formulas[t]).filter(Boolean);
      if (imgs.length) {
        const scale = (f) => Math.min(1, (CW - 24) / f.w);
        const hTot = imgs.reduce((acc, f) => acc + f.h * scale(f) + 4, 8);
        box((yy) => {
          let fy = yy + 6;
          imgs.forEach((f) => { const k = scale(f); doc.addImage(f.src, "PNG", LEFT + 12, fy, f.w * k, f.h * k); fy += f.h * k + 4; });
        }, hTot);
      }
      if (s.rows.length) {
        doc.setFontSize(9.5);
        s.rows.forEach(([k, v]) => {
          doc.setFont("times", "normal");
          const lines = doc.splitTextToSize(clean(v), CW * 0.6 - 6);
          const hh = Math.max(1, lines.length) * 12 + 4;
          ensure(hh);
          doc.text(doc.splitTextToSize(clean(k), CW * 0.4 - 6)[0], LEFT + 2, y + 11);
          lines.forEach((ln, j) => doc.text(ln, LEFT + CW * 0.4, y + 11 + j * 12));
          doc.setDrawColor(...GRID); doc.setLineWidth(0.3); doc.line(LEFT, y + hh, LEFT + CW, y + hh);
          y += hh;
        });
        y += 6;
      }
      s.tables.forEach((t) => table(t.headers, t.rows, null, { boldLast: t.rows.length && t.rows[t.rows.length - 1][0] === "TOTAL" }));
      if (s.blocks.length) {
        doc.setFont("courier", "normal"); doc.setFontSize(7);
        s.blocks.forEach((b) => {
          const lines = clean(b).split("\n");
          const hh = lines.length * 8.6 + 10;
          ensure(hh);
          doc.setFillColor(...ZEBRA); doc.setDrawColor(...GRID); doc.rect(LEFT, y, CW, hh, "FD");
          doc.setTextColor(...INK2);
          lines.forEach((ln, j) => doc.text(ln, LEFT + 6, y + 12 + j * 8.6));
          doc.setTextColor(0, 0, 0);
          y += hh + 4;
        });
        y += 4;
      }
    }

    heading("5. REFERENCIAS");
    const refs = [...new Set(A.INDICATORS.map((s) => s.reference))].sort();
    refs.push("Lugaresi et al. (2019). MediaPipe: A Framework for Building Perception Pipelines.",
      "Kartynnik et al. (2019). Real-time Facial Surface Geometry from Monocular Video (Face Mesh).",
      "Burden, R. & Faires, J. D. Análisis numérico (mínimos cuadrados, Newton-Raphson, bisección).");
    refs.forEach((r) => para("• " + r, { align: "left", after: 2 }));
    return doc;
  };
})(window.Armonia = window.Armonia || {});
