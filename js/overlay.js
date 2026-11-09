/* Dibujo de puntos y construcciones geométricas — equivalente a armonia/viz/overlay.py. */
"use strict";
(function (A) {
  const { L } = A;
  const COL = { cyan: "#22d3ee", violet: "#a78bfa", pink: "#f472b6", amber: "#fbbf24", green: "#4ade80", white: "#f0f4ff", mesh: "rgba(200,210,230,0.42)", dark: "#0f172a" };
  A.OVERLAY_DEFAULTS = { mesh: true, contours: true, keypoints: true, axis: true, symmetry: false, thirds: false, fifths: false, measures: false, labels: false };

  /** Vista recortada y escalada alrededor del rostro: p' = (p − origen)·s */
  function faceView(res, side, margin = 0.28) {
    const P = res.geometry.pointsImg;
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const lo = [Math.min(...xs), Math.min(...ys)], hi = [Math.max(...xs), Math.max(...ys)];
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    const sz = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * (1 + 2 * margin);
    return { origin: [c[0] - sz / 2, c[1] - sz / 2], s: side / sz };
  }

  A.renderView = function (res, opt, { side = 900, zoom = true } = {}) {
    opt = { ...A.OVERLAY_DEFAULTS, ...(opt || {}) };
    const g = res.geometry;
    const cv = document.createElement("canvas");
    let V;
    if (zoom) {
      V = faceView(res, side);
      cv.width = cv.height = side;
    } else {
      const s = Math.min(1, 1400 / Math.max(res.width, res.height));
      V = { origin: [0, 0], s };
      cv.width = Math.round(res.width * s); cv.height = Math.round(res.height * s);
    }
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(res.canvas, -V.origin[0] * V.s, -V.origin[1] * V.s, res.width * V.s, res.height * V.s);
    const v = (p) => [(p[0] - V.origin[0]) * V.s, (p[1] - V.origin[1]) * V.s];
    const T = (Pa) => g.toImage(Pa).map(v);
    const P = g.pointsImg.map(v);
    const ovalX = L.FACE_OVAL.map((i) => P[i][0]);
    const faceW = Math.max(...ovalX) - Math.min(...ovalX);
    const lw = Math.max(1.2, faceW / 300), r = Math.max(1.6, faceW / 260);

    const line = (a, b, color, w = lw, dash = null) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    const poly = (pts, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash([]);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    };
    const dot = (p, rad, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 2 * Math.PI); ctx.fill(); };
    const dash = [lw * 5, lw * 4];

    if (opt.mesh) {
      ctx.strokeStyle = COL.mesh; ctx.lineWidth = 0.8; ctx.setLineDash([]);
      ctx.beginPath();
      for (const e of A.TESSELATION || []) {
        const a = P[e.start], b = P[e.end];
        if (a && b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      }
      ctx.stroke();
    }
    if (opt.contours) {
      for (const [idx, col] of [[L.FACE_OVAL, COL.cyan], [L.RIGHT_EYE, COL.violet], [L.LEFT_EYE, COL.violet],
        [L.RIGHT_EYEBROW, COL.violet], [L.LEFT_EYEBROW, COL.violet], [L.LIPS_OUTER, COL.pink], [L.LIPS_INNER, COL.pink]]) {
        poly(idx.map((i) => P[i]), col);
      }
      for (const iris of [L.RIGHT_IRIS, L.LEFT_IRIS]) {
        const pts = iris.map((i) => P[i]);
        const c = [pts.reduce((s, p) => s + p[0], 0) / 4, pts.reduce((s, p) => s + p[1], 0) / 4];
        const rad = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / 4;
        ctx.strokeStyle = COL.amber; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, 2 * Math.PI); ctx.stroke();
      }
    }
    const Al = g.aligned;
    const axs = L.FACE_OVAL.map((i) => Al[i][0]), ays = L.FACE_OVAL.map((i) => Al[i][1]);
    const span = Math.max(...axs) - Math.min(...axs);
    const xLo = Math.min(...axs) - 0.08 * span, xHi = Math.max(...axs) + 0.08 * span;
    const yLo = Math.min(...ays), yHi = Math.max(...ays);
    if (opt.thirds) {
      for (const [name, col] of [["Glabela", COL.green], ["Subnasal", COL.green], ["Mentón", COL.green], ["Estomion", COL.amber], ["Pupila der.", COL.cyan]]) {
        const y = g.namedPoints[name][1];
        const [a, b] = T([[xLo, y], [xHi, y]]);
        line(a, b, col, lw, dash);
      }
    }
    if (opt.fifths) {
      for (const i of [L.R_FACE_EDGE, L.R_EYE_OUTER, L.R_EYE_INNER, L.L_EYE_INNER, L.L_EYE_OUTER, L.L_FACE_EDGE]) {
        const x = Al[i][0];
        const [a, b] = T([[x, yLo], [x, yHi]]);
        line(a, b, COL.amber, lw, dash);
      }
    }
    if (opt.symmetry) {
      const R1 = T(g.pairRight), R2 = T(g.pairLeftReflected);
      R1.forEach((a, k) => { line(a, R2[k], COL.amber); dot(R2[k], r * 0.9, COL.pink); dot(a, r * 0.9, COL.cyan); });
    }
    if (opt.axis) {
      const [a, b] = g.axisSegmentImage().map(v);
      line(a, b, COL.green, lw + 1, dash);
    }
    if (opt.measures) {
      const n = g.namedPoints;
      for (const [a, b, col] of [["Pupila der.", "Pupila izq.", COL.cyan], ["Borde facial der.", "Borde facial izq.", COL.violet],
        ["Ala nasal der.", "Ala nasal izq.", COL.pink], ["Comisura der.", "Comisura izq.", COL.pink],
        ["Canto int. der.", "Canto int. izq.", COL.amber], ["Frente (sup.)", "Mentón", COL.green]]) {
        const [p, q] = T([n[a], n[b]]);
        line(p, q, col, lw + 1);
        dot(p, r * 1.5, col); dot(q, r * 1.5, col);
      }
    }
    if (opt.keypoints) {
      const names = Object.keys(g.namedPoints);
      const pts = T(names.map((k) => g.namedPoints[k]));
      pts.forEach((p) => { dot(p, r * 2.1, COL.dark); dot(p, r * 1.4, COL.white); });
      if (opt.labels) {
        const fs = Math.max(11, Math.round(cv.width / 62));
        ctx.font = `600 ${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = "top";
        const placed = [];
        pts.forEach((p, k) => {
          const text = names[k];
          const w = ctx.measureText(text).width + 8, h = fs + 6;
          let x = p[0] + fs * 0.6, y = p[1] - fs * 1.4;
          for (let t = 0; t < 12; t++) {
            if (!placed.some((q) => x < q[2] && x + w > q[0] && y < q[3] && y + h > q[1])) break;
            y += h + 2;
          }
          placed.push([x, y, x + w, y + h]);
          ctx.fillStyle = "rgba(15,23,42,0.82)";
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 4) : ctx.rect(x, y, w, h); ctx.fill();
          ctx.fillStyle = COL.white; ctx.fillText(text, x + 4, y + 3);
        });
      }
    }
    return cv;
  };

  /** Solo la foto recortada (sin capas), con el mismo encuadre que renderView. */
  A.renderPlain = function (res, { side = 900, zoom = true } = {}) {
    return A.renderView(res, { mesh: false, contours: false, keypoints: false, axis: false }, { side, zoom });
  };
})(window.Armonia = window.Armonia || {});
