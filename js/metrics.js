/* Indicadores geométricos — traducción fiel de armonia/core/metrics.py. */
"use strict";
(function (A) {
  const { NM, L } = A;

  const score100 = (err, sigma) => 100 * NM.gaussianScore(err, sigma);

  function ratioIndicator(spec, num, den, numLabel, denLabel) {
    if (den <= 1e-9) throw new Error(`Distancia nula al calcular «${spec.name}».`);
    const r = num / den;
    const err = NM.relativeError(r, spec.ideal);
    const s = score100(err, spec.sigma);
    return {
      spec, measured: r, error: err, errorKind: "relativo", score: s,
      steps: [
        [numLabel, `${num.toFixed(2)} px`],
        [denLabel, `${den.toFixed(2)} px`],
        ["Cociente medido r", `${num.toFixed(2)} / ${den.toFixed(2)} = ${r.toFixed(4)}`],
        ["Valor ideal r*", spec.ideal.toFixed(4)],
        ["Error relativo E = |r − r*| / r*", `|${r.toFixed(4)} − ${spec.ideal.toFixed(4)}| / ${spec.ideal.toFixed(4)} = ${err.toFixed(4)}`],
        ["Puntuación 100·exp(−½(E/σ)²)", `σ = ${spec.sigma}  →  ${s.toFixed(2)}`],
      ],
    };
  }

  function pupils(P) {
    const eyeR = NM.meanPoint(L.RIGHT_EYE.map((i) => P[i]));
    const eyeL = NM.meanPoint(L.LEFT_EYE.map((i) => P[i]));
    if (P.length >= L.NUM) {
      let a = NM.meanPoint(L.RIGHT_IRIS.map((i) => P[i]));
      let b = NM.meanPoint(L.LEFT_IRIS.map((i) => P[i]));
      if (NM.dist(a, eyeR) > NM.dist(a, eyeL)) [a, b] = [b, a];
      return [a, b];
    }
    return [eyeR, eyeL];
  }

  A.computeGeometry = function (pointsImg) {
    const P0 = pointsImg.map((p) => [p[0], p[1]]);
    if (P0.length < 468) throw new Error(`Se esperaban 468 o 478 puntos y se recibieron ${P0.length}.`);

    // 1. alineación
    const [pr0, pl0] = pupils(P0);
    const center = NM.midpoint(pr0, pl0);
    let theta = NM.segmentAngle(pr0, pl0);
    if (theta > Math.PI / 2) theta -= Math.PI;
    else if (theta <= -Math.PI / 2) theta += Math.PI;
    const Al = NM.rotatePoints(P0, -theta, center);
    const [pr, pl] = pupils(Al);
    const iod = NM.dist(pr, pl);
    if (iod < 8) throw new Error("El rostro es demasiado pequeño para medirlo con precisión.");

    // 2. eje medio por mínimos cuadrados
    const rightIdx = L.ALL_PAIRS.map((p) => p[0]), leftIdx = L.ALL_PAIRS.map((p) => p[1]);
    const mids = rightIdx.map((r, k) => NM.midpoint(Al[r], Al[leftIdx[k]]));
    const axisPts = mids.concat(L.MIDLINE.map((i) => Al[i]));
    const fit = NM.leastSquaresXonY(axisPts);
    const [c, n] = fit.pointAndNormal(center[1]);

    // 3. simetría bilateral
    const prPts = rightIdx.map((i) => Al[i]), plPts = leftIdx.map((i) => Al[i]);
    const plRef = NM.reflectPoints(plPts, c, n);
    const pairErr = NM.dists(prPts, plRef).map((d) => d / iod);
    const regions = L.SYMMETRIC_PAIRS.flatMap(([name, pairs]) => pairs.map(() => name));
    const regionErr = {};
    for (const [name] of L.SYMMETRIC_PAIRS) regionErr[name] = NM.mean(pairErr.filter((_, i) => regions[i] === name));
    const dMean = NM.mean(pairErr);
    let spec = A.INDICATOR_BY_KEY.sym_reflection;
    let s = score100(dMean, spec.sigma);
    const iSym = {
      spec, measured: dMean, error: dMean, errorKind: "absoluto", score: s,
      steps: [
        ["Pares simétricos evaluados", String(pairErr.length)],
        ["Eje x = m·y + b", `m = ${fit.m.toFixed(5)},  b = ${fit.b.toFixed(2)} px`],
        ["Distancia interpupilar (DIP)", `${iod.toFixed(2)} px`],
        ["Error medio d̄ = (1/n)·Σ‖p_d − p'_i‖ / DIP", dMean.toFixed(4)],
        ["Error RMS", NM.rms(pairErr).toFixed(4)],
        ["Error máximo", Math.max(...pairErr).toFixed(4)],
        ["Puntuación 100·exp(−½(d̄/σ)²)", `σ = ${spec.sigma}  →  ${s.toFixed(2)}`],
      ],
    };

    // 4. áreas de hemicaras
    const oval = L.FACE_OVAL.map((i) => Al[i]);
    const hemiPos = NM.clipPolygonHalfplane(oval, c, n, true);
    const hemiNeg = NM.clipPolygonHalfplane(oval, c, n, false);
    const aPos = NM.shoelaceArea(hemiPos), aNeg = NM.shoelaceArea(hemiNeg);
    if (Math.max(aPos, aNeg) <= 0) throw new Error("No se pudo calcular el área del contorno facial.");
    const areaRatio = Math.min(aPos, aNeg) / Math.max(aPos, aNeg);
    spec = A.INDICATOR_BY_KEY.sym_area;
    let err = NM.relativeError(areaRatio, spec.ideal);
    s = score100(err, spec.sigma);
    const iArea = {
      spec, measured: areaRatio, error: err, errorKind: "relativo", score: s,
      steps: [
        ["Área hemicara 1 (Gauss)", `${NM.fmtComma(aPos, 1)} px²`],
        ["Área hemicara 2 (Gauss)", `${NM.fmtComma(aNeg, 1)} px²`],
        ["Área total", `${NM.fmtComma(NM.shoelaceArea(oval), 1)} px²`],
        ["Cociente A_menor / A_mayor", areaRatio.toFixed(4)],
        ["Error relativo |r − 1|", err.toFixed(4)],
        ["Puntuación", `σ = ${spec.sigma}  →  ${s.toFixed(2)}`],
      ],
    };

    // 5. puntos y distancias
    const axisXNose = fit.xAt(Al[L.NOSE_TIP][1]);
    const pickFar = (cands) => cands.reduce((best, i) => (Math.abs(Al[i][0] - axisXNose) > Math.abs(Al[best][0] - axisXNose) ? i : best), cands[0]);
    const rAla = Al[pickFar(L.R_ALA_CANDIDATES)], lAla = Al[pickFar(L.L_ALA_CANDIDATES)];
    const stomion = NM.midpoint(Al[L.UPPER_LIP_INNER], Al[L.LOWER_LIP_INNER]);
    const pupilMid = NM.midpoint(pr, pl);
    const named = {
      "Pupila der.": pr, "Pupila izq.": pl,
      "Canto ext. der.": Al[L.R_EYE_OUTER], "Canto int. der.": Al[L.R_EYE_INNER],
      "Canto int. izq.": Al[L.L_EYE_INNER], "Canto ext. izq.": Al[L.L_EYE_OUTER],
      "Ala nasal der.": rAla, "Ala nasal izq.": lAla,
      "Comisura der.": Al[L.R_MOUTH], "Comisura izq.": Al[L.L_MOUTH],
      "Borde facial der.": Al[L.R_FACE_EDGE], "Borde facial izq.": Al[L.L_FACE_EDGE],
      "Frente (sup.)": Al[L.TOP_FOREHEAD], "Glabela": Al[L.GLABELLA],
      "Subnasal": Al[L.SUBNASALE], "Estomion": stomion, "Mentón": Al[L.MENTON],
    };
    const d = NM.dist;
    const D = {
      "Distancia interpupilar": iod,
      "Ancho facial": d(Al[L.R_FACE_EDGE], Al[L.L_FACE_EDGE]),
      "Largo facial": d(Al[L.TOP_FOREHEAD], Al[L.MENTON]),
      "Ancho ojo der.": d(Al[L.R_EYE_OUTER], Al[L.R_EYE_INNER]),
      "Ancho ojo izq.": d(Al[L.L_EYE_INNER], Al[L.L_EYE_OUTER]),
      "Distancia intercantal": d(Al[L.R_EYE_INNER], Al[L.L_EYE_INNER]),
      "Ancho nasal": d(rAla, lAla),
      "Ancho de boca": d(Al[L.R_MOUTH], Al[L.L_MOUTH]),
      "Tercio medio (glabela–subnasal)": d(Al[L.GLABELLA], Al[L.SUBNASALE]),
      "Tercio inferior (subnasal–mentón)": d(Al[L.SUBNASALE], Al[L.MENTON]),
      "Labio sup. (subnasal–estomion)": d(Al[L.SUBNASALE], stomion),
      "Mentón (estomion–mentón)": d(stomion, Al[L.MENTON]),
      "Ojos–boca (pupilas–estomion)": d(pupilMid, stomion),
    };

    // 6. regla de los quintos
    const xs = [L.R_FACE_EDGE, L.R_EYE_OUTER, L.R_EYE_INNER, L.L_EYE_INNER, L.L_EYE_OUTER, L.L_FACE_EDGE].map((i) => Al[i][0]);
    const fifths = [0, 1, 2, 3, 4].map((k) => Math.abs(xs[k + 1] - xs[k]));
    const cv = NM.coefficientOfVariation(fifths);
    spec = A.INDICATOR_BY_KEY.fifths;
    s = score100(cv, spec.sigma);
    const iFifths = {
      spec, measured: cv, error: cv, errorKind: "absoluto", score: s,
      steps: [
        ["Segmentos q₁…q₅ (px)", fifths.map((q) => q.toFixed(1)).join(", ")],
        ["Normalizados por DIP", fifths.map((q) => (q / iod).toFixed(3)).join(", ")],
        ["Media μ", `${NM.mean(fifths).toFixed(2)} px`],
        ["Desviación estándar σ_q", `${NM.std(fifths).toFixed(2)} px`],
        ["CV = σ_q / μ", cv.toFixed(4)],
        ["Puntuación", `σ = ${spec.sigma}  →  ${s.toFixed(2)}`],
      ],
    };

    // 7. cocientes
    const I = A.INDICATOR_BY_KEY;
    const byKey = {
      sym_reflection: iSym, sym_area: iArea, fifths: iFifths,
      nose_intercanthal: ratioIndicator(I.nose_intercanthal, D["Ancho nasal"], D["Distancia intercantal"], "Ancho nasal (alas)", "Distancia intercantal"),
      mouth_nose: ratioIndicator(I.mouth_nose, D["Ancho de boca"], D["Ancho nasal"], "Ancho de boca (comisuras)", "Ancho nasal"),
      thirds: ratioIndicator(I.thirds, D["Tercio medio (glabela–subnasal)"], D["Tercio inferior (subnasal–mentón)"], "Tercio medio", "Tercio inferior"),
      lower_third: ratioIndicator(I.lower_third, D["Labio sup. (subnasal–estomion)"], D["Mentón (estomion–mentón)"], "Subnasal–estomion", "Estomion–mentón"),
      ipd_width: ratioIndicator(I.ipd_width, D["Distancia interpupilar"], D["Ancho facial"], "Distancia interpupilar", "Ancho facial"),
      eye_mouth_length: ratioIndicator(I.eye_mouth_length, D["Ojos–boca (pupilas–estomion)"], D["Largo facial"], "Pupilas–estomion", "Largo facial"),
    };
    const indicators = A.INDICATORS.map((sp) => byKey[sp.key]);
    indicators.forEach((i) => { i.contribution = i.spec.weight * i.score; });
    const finalScore = NM.weightedMean(indicators.map((i) => i.score), indicators.map((i) => i.spec.weight));
    const [phi, phiIt] = NM.goldenRatioNewton(1);

    const geo = {
      pointsImg: P0, aligned: Al, rollRad: theta, center, pupilR: pr, pupilL: pl, iod,
      axisFit: fit, axisPoints: axisPts, axisC: c, axisN: n,
      pairRight: prPts, pairLeft: plPts, pairLeftReflected: plRef, pairErrors: pairErr,
      pairRegions: regions, regionErrors: regionErr, hemiPos, hemiNeg, areaPos: aPos, areaNeg: aNeg,
      distances: D, namedPoints: named, fifths, indicators, finalScore,
      phiNewton: phi, phiIterations: phiIt,
    };
    geo.toImage = (Pa) => NM.rotatePoints(Pa, theta, center);
    geo.axisSegmentImage = () => {
      const ys = Al.map((p) => p[1]);
      const y0 = Math.min(...ys), y1 = Math.max(...ys), pad = 0.06 * (y1 - y0);
      return geo.toImage([[fit.xAt(y0 - pad), y0 - pad], [fit.xAt(y1 + pad), y1 + pad]]);
    };
    geo.indicator = (key) => indicators.find((i) => i.spec.key === key);
    return geo;
  };
})(window.Armonia = window.Armonia || {});
