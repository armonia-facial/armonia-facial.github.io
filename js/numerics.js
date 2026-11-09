/* Métodos numéricos — traducción fiel de armonia/core/numerics.py.
   Puntos como arreglos [x, y] en píxeles (eje y hacia abajo). */
"use strict";
(function (A) {
  const NM = {};
  NM.PHI_EXACT = (1 + Math.sqrt(5)) / 2;

  // ------------------------------------------------------------ geometría
  NM.dist = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1]; return Math.sqrt(dx * dx + dy * dy); };
  NM.dists = (P, Q) => P.map((p, i) => NM.dist(p, Q[i]));
  NM.midpoint = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  NM.mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  NM.meanPoint = (P) => [NM.mean(P.map((p) => p[0])), NM.mean(P.map((p) => p[1]))];
  NM.segmentAngle = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
  NM.rotationMatrix = (t) => [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]];
  /** p' = R(θ)·(p − c) + c */
  NM.rotatePoints = (P, t, c) => {
    const co = Math.cos(t), si = Math.sin(t);
    return P.map(([x, y]) => {
      const dx = x - c[0], dy = y - c[1];
      return [dx * co - dy * si + c[0], dx * si + dy * co + c[1]];
    });
  };

  // ------------------------------------------------------------ Gauss con pivoteo parcial
  NM.gaussElimination = (Ain, bin) => {
    const n = Ain.length;
    const M = Ain.map((row, i) => [...row, bin[i]]);
    const copy = () => M.map((r) => r.slice());
    const steps = [["Matriz aumentada [A | b]", copy()]];
    for (let k = 0; k < n - 1; k++) {
      let piv = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
      if (Math.abs(M[piv][k]) < 1e-14) throw new Error("Sistema singular: pivote nulo");
      if (piv !== k) { [M[k], M[piv]] = [M[piv], M[k]]; steps.push([`Pivoteo: F${k + 1} ↔ F${piv + 1}`, copy()]); }
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / M[k][k];
        for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
        steps.push([`F${i + 1} ← F${i + 1} − (${NM.fmtG(f, 6)})·F${k + 1}`, copy()]);
      }
    }
    if (Math.abs(M[n - 1][n - 1]) < 1e-14) throw new Error("Sistema singular: pivote nulo");
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    steps.push(["Sustitución regresiva", copy()]);
    return { solution: x, steps };
  };

  // ------------------------------------------------------------ mínimos cuadrados x = m·y + b
  NM.leastSquaresXonY = (P) => {
    const n = P.length;
    let sy2 = 0, sy = 0, sxy = 0, sx = 0;
    for (const [x, y] of P) { sy2 += y * y; sy += y; sxy += x * y; sx += x; }
    const N = [[sy2, sy], [sy, n]], r = [sxy, sx];
    const g = NM.gaussElimination(N, r);
    const [m, b] = g.solution;
    const residuals = P.map(([x, y]) => x - (m * y + b));
    const ssRes = residuals.reduce((s, e) => s + e * e, 0);
    const xm = sx / n;
    const ssTot = P.reduce((s, [x]) => s + (x - xm) * (x - xm), 0);
    return {
      m, b, normalMatrix: N, rhs: r, gauss: g, residuals, n,
      rms: Math.sqrt(ssRes / n), r2: ssTot > 1e-12 ? 1 - ssRes / ssTot : 1,
      xAt: (y) => m * y + b,
      angleFromVerticalDeg: Math.atan(m) * 180 / Math.PI,
      pointAndNormal: (yref) => [[m * yref + b, yref], [1 / Math.sqrt(1 + m * m), -m / Math.sqrt(1 + m * m)]],
    };
  };

  NM.signedDistance = (P, c, n) => P.map(([x, y]) => (x - c[0]) * n[0] + (y - c[1]) * n[1]);
  /** Reflexión de Householder: p' = p − 2·((p − c)·n)·n */
  NM.reflectPoints = (P, c, n) => {
    const d = NM.signedDistance(P, c, n);
    return P.map(([x, y], i) => [x - 2 * d[i] * n[0], y - 2 * d[i] * n[1]]);
  };

  // ------------------------------------------------------------ áreas
  NM.shoelaceArea = (P, signed = false) => {
    if (P.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      s += x1 * y2 - x2 * y1;
    }
    return signed ? 0.5 * s : Math.abs(0.5 * s);
  };
  /** Sutherland–Hodgman contra el semiplano (p − c)·n ≥ 0 */
  NM.clipPolygonHalfplane = (P, c, n, keepPositive = true) => {
    const sign = keepPositive ? 1 : -1;
    const d = NM.signedDistance(P, c, n).map((v) => v * sign);
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], da = d[i], db = d[(i + 1) % P.length];
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    return out;
  };

  // ------------------------------------------------------------ errores y puntuación
  NM.relativeError = (m, ideal) => Math.abs(m - ideal) / Math.abs(ideal);
  NM.gaussianScore = (e, s) => Math.exp(-0.5 * (e / s) ** 2);
  NM.std = (v) => { const mu = NM.mean(v); return Math.sqrt(NM.mean(v.map((x) => (x - mu) ** 2))); };
  NM.minMaxNormalize = (v) => {
    const lo = Math.min(...v), hi = Math.max(...v);
    return hi - lo < 1e-15 ? v.map(() => 0) : v.map((x) => Math.min(1, Math.max(0, (x - lo) / (hi - lo))));
  };
  NM.zScores = (v) => { const mu = NM.mean(v), s = NM.std(v); return s < 1e-15 ? v.map(() => 0) : v.map((x) => (x - mu) / s); };
  NM.coefficientOfVariation = (v) => NM.std(v) / Math.abs(NM.mean(v));
  NM.weightedMean = (v, w) => v.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0);
  NM.rms = (v) => Math.sqrt(NM.mean(v.map((x) => x * x)));

  // ------------------------------------------------------------ raíces
  NM.newtonRaphson = (f, df, x0, tol = 1e-12, maxIter = 50) => {
    const rec = [{ k: 0, x: x0, fx: f(x0), error: NaN }];
    let x = x0;
    for (let k = 1; k <= maxIter; k++) {
      const xn = x - f(x) / df(x);
      const err = Math.abs(xn - x);
      rec.push({ k, x: xn, fx: f(xn), error: err });
      x = xn;
      if (err < tol) break;
    }
    return [x, rec];
  };
  NM.bisection = (f, a, b, tol = 1e-10, maxIter = 200) => {
    let fa = f(a);
    const rec = [];
    let c = a;
    for (let k = 1; k <= maxIter; k++) {
      c = (a + b) / 2;
      const fc = f(c);
      rec.push({ k, x: c, fx: fc, error: (b - a) / 2 });
      if (fc === 0 || (b - a) / 2 < tol) break;
      if (fa * fc < 0) b = c; else { a = c; fa = fc; }
    }
    return [c, rec];
  };
  NM.goldenRatioNewton = (x0 = 1) => NM.newtonRaphson((x) => x * x - x - 1, (x) => 2 * x - 1, x0, 1e-12);

  // ------------------------------------------------------------ imagen
  /** Varianza del Laplaciano discreto (diferencias finitas) sobre gris [h][w] plano. */
  NM.laplacianVariance = (gray, w, h) => {
    let n = 0, s = 0, s2 = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
        n++; s += v; s2 += v * v;
      }
    }
    const mu = s / n;
    return s2 / n - mu * mu;
  };
  /** Ángulos de Euler (yaw, pitch, roll) en grados desde una matriz 3×3 (filas). */
  NM.eulerFromMatrix = (R) => {
    // Se normaliza cada columna para quitar la escala de la matriz de MediaPipe.
    const cols = [0, 1, 2].map((j) => Math.hypot(R[0][j], R[1][j], R[2][j]) || 1);
    const r = R.map((row) => row.map((v, j) => v / cols[j]));
    const sy = Math.hypot(r[0][0], r[1][0]);
    const deg = 180 / Math.PI;
    if (sy > 1e-9) return [Math.atan2(-r[2][0], sy) * deg, Math.atan2(r[2][1], r[2][2]) * deg, Math.atan2(r[1][0], r[0][0]) * deg];
    return [Math.atan2(-r[2][0], sy) * deg, Math.atan2(-r[1][2], r[1][1]) * deg, 0];
  };

  // ------------------------------------------------------------ formato numérico estilo Python
  const pyExp = (s) => s.replace(/e([+-])(\d)$/, "e$10$2");
  /** Equivalente de f"{v:.{p}g}" */
  NM.fmtG = (v, p = 6) => {
    if (v === 0) return "0";
    if (!isFinite(v)) return String(v);
    const e = Math.floor(Math.log10(Math.abs(Number(v.toPrecision(p)))));
    if (e < -4 || e >= p) {
      let s = v.toExponential(p - 1);
      let [mant, ex] = s.split("e");
      if (mant.includes(".")) mant = mant.replace(/0+$/, "").replace(/\.$/, "");
      return pyExp(mant + "e" + ex);
    }
    let s = v.toFixed(Math.max(0, p - 1 - e));
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  };
  /** Equivalente de f"{v:.{d}e}" */
  NM.fmtE = (v, d = 3) => pyExp(v.toExponential(d));
  /** Equivalente de f"{v:,.{d}f}" */
  NM.fmtComma = (v, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  NM.fmtSigned = (v, d) => (v >= 0 ? "+" : "") + v.toFixed(d);

  A.NM = NM;
})(window.Armonia = window.Armonia || {});
