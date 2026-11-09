/* Explicación paso a paso con valores reales — traducción de armonia/core/explain.py.
   Las fórmulas (TeX) son idénticas a las de Python: sus imágenes vienen de recursos.js. */
"use strict";
(function (A) {
  const { NM, L } = A;
  const R = String.raw;
  const p2 = (p) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;

  function fmtMatrix(M, aug = true, prec = 6) {
    const cells = M.map((row) => row.map((v) => NM.fmtG(v, prec)));
    const width = Math.max(...cells.flat().map((c) => c.length));
    return cells.map((row) => {
      const pad = (c) => c.padStart(width);
      if (aug && row.length > 1) return `[ ${row.slice(0, -1).map(pad).join("  ")} | ${pad(row[row.length - 1])} ]`;
      return `[ ${row.map(pad).join("  ")} ]`;
    }).join("\n");
  }

  A.buildSections = function (res) {
    const g = res.geometry, det = res.detection;
    const w = res.width, h = res.height;
    const S = [];
    const sec = (number, title, text, formulas = [], rows = [], tables = [], blocks = []) =>
      S.push({ number, title, text, formulas, rows, tables, blocks });

    // 1
    const n1 = det.pointsNorm[L.NOSE_TIP];
    const rows1 = [
      ["Imagen de trabajo (W × H)", `${w} × ${h} px`],
      ["Rostros detectados", String(det.numFaces)],
      ["Puntos faciales", `${det.pointsPx.length} (468 malla + 10 iris)`],
      ["Ejemplo: punta nasal (normalizada)", `x = ${n1[0].toFixed(5)}, y = ${n1[1].toFixed(5)}`],
      ["Punta nasal en píxeles", `x = ${n1[0].toFixed(5)}·${w} = ${(n1[0] * w).toFixed(2)},  y = ${n1[1].toFixed(5)}·${h} = ${(n1[1] * h).toFixed(2)}`],
    ];
    if (det.yaw != null) rows1.push(["Pose (giro, cabeceo, inclinación)", `${NM.fmtSigned(det.yaw, 1)}°, ${NM.fmtSigned(det.pitch, 1)}°, ${NM.fmtSigned(det.roll, 1)}°`]);
    sec(1, "Detección facial y coordenadas",
      "MediaPipe Face Landmarker localiza el rostro y devuelve 478 puntos con coordenadas normalizadas en [0, 1]. Se convierten a píxeles multiplicando por el ancho y el alto. La pose se obtiene descomponiendo la matriz de rotación 3×3 en ángulos de Euler.",
      [R`x_{px} = x_n \cdot W \qquad y_{px} = y_n \cdot H`,
       R`\mathrm{yaw} = \mathrm{atan2}\left(-r_{31},\ \sqrt{r_{11}^2 + r_{21}^2}\right)`], rows1);

    // 2
    const pr = g.pupilR, pl = g.pupilL, dx = pl[0] - pr[0], dy = pl[1] - pr[1];
    sec(2, "Distancia euclidiana",
      "Todas las longitudes del rostro se miden como distancias euclidianas entre dos puntos del plano. Ejemplo con la distancia interpupilar (DIP), que se usa como unidad de medida para normalizar.",
      [R`d(P,Q) = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}`],
      [["Pupila derecha P", p2(pr)], ["Pupila izquierda Q", p2(pl)], ["Δx, Δy", `${dx.toFixed(2)}, ${dy.toFixed(2)}`],
       ["DIP", `√(${dx.toFixed(2)}² + ${dy.toFixed(2)}²) = ${g.iod.toFixed(3)} px`]],
      [{ headers: ["Distancia", "Valor (px)", "Normalizada (÷ DIP)"],
         rows: Object.entries(g.distances).map(([k, v]) => [k, v.toFixed(2), (v / g.iod).toFixed(4)]) }]);

    // 3
    const th = g.rollRad;
    const [pr0] = NM.rotatePoints([pr], th, g.center), [pl0] = NM.rotatePoints([pl], th, g.center);
    sec(3, "Alineación por rotación",
      "Para que la medición no dependa de la inclinación de la cabeza, se calcula el ángulo de la línea de las pupilas y se rotan los 478 puntos un ángulo −θ alrededor del punto medio de las pupilas c. Tras la rotación, los ojos quedan horizontales.",
      [R`\theta = \mathrm{atan2}(y_Q - y_P,\ x_Q - x_P)`,
       R`x' = (x - c_x)\cos\theta + (y - c_y)\sin\theta + c_x`,
       R`y' = -(x - c_x)\sin\theta + (y - c_y)\cos\theta + c_y`],
      [["Pupilas en la foto original", `P = ${p2(pr0)},  Q = ${p2(pl0)}`], ["Centro de rotación c", p2(g.center)],
       ["Ángulo θ", `${NM.fmtSigned(th * 180 / Math.PI, 4)}°  (${NM.fmtSigned(th, 6)} rad)`],
       ["cos θ, sin θ", `${Math.cos(th).toFixed(6)}, ${Math.sin(th).toFixed(6)}`]],
      [], ["R(−θ) =\n" + fmtMatrix(NM.rotationMatrix(-th), false)]);

    // 4
    const scores = g.indicators.map((i) => i.score);
    const mm = NM.minMaxNormalize(scores), z = NM.zScores(scores);
    sec(4, "Normalización",
      "Dividir entre la DIP elimina la escala (tamaño de la foto, distancia a la cámara). Además, la normalización mín–máx y la puntuación z permiten comparar indicadores entre sí: z indica cuántas desviaciones estándar se aleja cada indicador de la media.",
      [R`\hat{d} = \dfrac{d}{\mathrm{DIP}}`,
       R`v' = \dfrac{v - v_{min}}{v_{max} - v_{min}} \qquad z = \dfrac{v - \mu}{\sigma}`],
      [["Media de puntuaciones μ", NM.mean(scores).toFixed(3)], ["Desviación estándar σ", NM.std(scores).toFixed(3)]],
      [{ headers: ["Indicador", "Puntuación", "Mín–máx", "z"],
         rows: g.indicators.map((i, k) => [i.spec.name, scores[k].toFixed(2), mm[k].toFixed(3), NM.fmtSigned(z[k], 3)]) }]);

    // 5
    const fit = g.axisFit;
    sec(5, "Eje de simetría por mínimos cuadrados",
      `Se ajusta la recta x = m·y + b a ${fit.n} puntos: los puntos medios de cada par simétrico y los puntos de la línea media. Se regresa x sobre y porque el eje es casi vertical (con y = a·x + c la pendiente sería casi infinita y el sistema estaría mal condicionado). Derivando S e igualando a cero se obtienen las ecuaciones normales, que se resuelven por eliminación de Gauss con pivoteo parcial.`,
      [R`S(m,b) = \sum_{i=1}^{n} (x_i - m\,y_i - b)^2`,
       R`\dfrac{\partial S}{\partial m} = 0:\quad m\sum y_i^2 + b\sum y_i = \sum x_i y_i`,
       R`\dfrac{\partial S}{\partial b} = 0:\quad m\sum y_i + b\,n = \sum x_i`,
       R`R^2 = 1 - \dfrac{\sum (x_i - \hat{x}_i)^2}{\sum (x_i - \bar{x})^2}`],
      [["Σy², Σy", `${NM.fmtComma(fit.normalMatrix[0][0])}, ${NM.fmtComma(fit.normalMatrix[0][1])}`],
       ["Σxy, Σx", `${NM.fmtComma(fit.rhs[0])}, ${NM.fmtComma(fit.rhs[1])}`],
       ["Pendiente m", `${fit.m.toFixed(6)}  (ángulo con la vertical: ${NM.fmtSigned(fit.angleFromVerticalDeg, 3)}°)`],
       ["Intercepto b", `${fit.b.toFixed(4)} px`],
       ["Error RMS de los residuos", `${fit.rms.toFixed(4)} px`],
       ["Coeficiente R²", `${fit.r2.toFixed(4)}  (bajo es normal: x casi no varía con y)`]],
      [], fit.gauss.steps.map(([t, M]) => `${t}\n${fmtMatrix(M)}`));

    // 6
    const kEx = L.ALL_PAIRS.findIndex(([r, l]) => r === L.R_EYE_OUTER && l === L.L_EYE_OUTER);
    const pd = g.pairRight[kEx], pi = g.pairLeft[kEx], piRef = g.pairLeftReflected[kEx];
    const distEx = (pi[0] - g.axisC[0]) * g.axisN[0] + (pi[1] - g.axisC[1]) * g.axisN[1];
    sec(6, "Reflexión de Householder y simetría bilateral",
      "Cada punto del lado izquierdo se refleja respecto al eje (c, n̂). Si el rostro fuera perfectamente simétrico, el punto reflejado caería exactamente sobre su par del lado derecho. La distancia entre ambos, dividida por la DIP, mide la asimetría.",
      [R`p' = p - 2\,[(p - c)\cdot\hat{n}]\,\hat{n} \qquad \hat{n} = \dfrac{(1,\ -m)}{\sqrt{1 + m^2}}`,
       R`\bar{d} = \dfrac{1}{n}\sum_{i=1}^{n} \dfrac{\Vert p_{der,i} - p'_{izq,i} \Vert}{\mathrm{DIP}}`],
      [["Ejemplo: canto externo izq.", p2(pi)], ["(p − c)·n̂", `${distEx.toFixed(3)} px`], ["Reflejado p'", p2(piRef)],
       ["Canto externo der.", p2(pd)], ["‖p_der − p'‖ / DIP", g.pairErrors[kEx].toFixed(4)]].concat(g.indicator("sym_reflection").steps),
      [{ headers: ["Región", "Pares", "Error medio (÷ DIP)"],
         rows: Object.entries(g.regionErrors).map(([k, v]) => [k, String(g.pairRegions.filter((r) => r === k).length), v.toFixed(4)]) }]);

    // 7
    sec(7, "Área de las hemicaras (fórmula de Gauss)",
      "El contorno facial (36 puntos) se corta con el eje de simetría mediante el algoritmo de Sutherland–Hodgman: cuando una arista cruza el eje se interpola el punto de corte. El área de cada mitad se calcula con la fórmula del cordón (shoelace), que es la versión discreta del teorema de Green.",
      [R`A = \dfrac{1}{2}\left|\sum_{i=1}^{n} (x_i\,y_{i+1} - x_{i+1}\,y_i)\right|`,
       R`p = p_a + t\,(p_b - p_a), \qquad t = \dfrac{d_a}{d_a - d_b}`],
      [["Vértices hemicara 1 / 2", `${g.hemiPos.length} / ${g.hemiNeg.length}`]].concat(g.indicator("sym_area").steps));

    // 8
    const ratioInds = g.indicators.filter((i) => i.errorKind === "relativo" && i.spec.key !== "sym_area");
    sec(8, "Proporciones y error relativo",
      "Cada proporción es un cociente de distancias euclidianas (adimensional). Se compara con el valor ideal del canon mediante el error relativo.",
      [R`r = \dfrac{d_1}{d_2} \qquad E_{rel} = \dfrac{|r - r^*|}{|r^*|}`,
       R`\varphi = \dfrac{1 + \sqrt{5}}{2} \approx 1.618034`], [],
      [{ headers: ["Indicador", "Medido r", "Ideal r*", "E_rel", "Referencia"],
         rows: ratioInds.map((i) => [i.spec.name, i.measured.toFixed(4), i.spec.ideal.toFixed(4), i.error.toFixed(4), i.spec.reference]) }]);

    // 9
    sec(9, "Regla de los quintos (coeficiente de variación)",
      "A la altura de los ojos se miden cinco segmentos horizontales: lateral derecho, ojo derecho, entre ojos, ojo izquierdo y lateral izquierdo. Si fueran iguales, la desviación estándar sería 0. El coeficiente de variación mide la dispersión relativa.",
      [R`\mu = \dfrac{1}{5}\sum_{k=1}^{5} q_k \qquad \sigma_q = \sqrt{\dfrac{1}{5}\sum_{k=1}^{5}(q_k - \mu)^2}`,
       R`CV = \dfrac{\sigma_q}{\mu}`], g.indicator("fifths").steps);

    // 10
    const [, bis] = NM.bisection((x) => x * x - x - 1, 1, 2, 1e-12);
    sec(10, "Razón áurea φ por Newton-Raphson",
      `El valor ideal de la proporción boca/nariz es φ, raíz positiva de f(x) = x² − x − 1. Se calcula con Newton-Raphson (convergencia cuadrática) partiendo de x₀ = 1 y se compara con bisección en [1, 2], que necesita ${bis.length} iteraciones para la misma tolerancia.`,
      [R`f(x) = x^2 - x - 1 \qquad f'(x) = 2x - 1`,
       R`x_{k+1} = x_k - \dfrac{f(x_k)}{f'(x_k)} = x_k - \dfrac{x_k^2 - x_k - 1}{2x_k - 1}`],
      [["φ (Newton-Raphson)", g.phiNewton.toFixed(15)], ["φ exacto (1 + √5)/2", NM.PHI_EXACT.toFixed(15)],
       ["Diferencia", NM.fmtE(Math.abs(g.phiNewton - NM.PHI_EXACT), 2)]],
      [{ headers: ["k", "x_k", "f(x_k)", "|x_k − x_(k−1)|"],
         rows: g.phiIterations.map((r) => [String(r.k), r.x.toFixed(15), NM.fmtE(r.fx, 3), isNaN(r.error) ? "—" : NM.fmtE(r.error, 3)]) }]);

    // 11
    sec(11, "Función de puntuación gaussiana",
      "Cada error se transforma en una puntuación de 0 a 100 con un núcleo gaussiano. σ es la tolerancia del indicador: con E = σ se obtienen 60.7 puntos y con E = 2σ, 13.5. La función es continua y suave, así que pequeñas variaciones en la foto producen pequeñas variaciones en la nota.",
      [R`s_i = 100 \cdot e^{-\frac{1}{2}\left(\frac{E_i}{\sigma_i}\right)^2}`], [],
      [{ headers: ["Indicador", "Error E", "Tipo", "σ", "E/σ", "s"],
         rows: g.indicators.map((i) => [i.spec.name, i.error.toFixed(4), i.errorKind, String(i.spec.sigma), (i.error / i.spec.sigma).toFixed(3), i.score.toFixed(2)]) }]);

    // 12
    const wsum = g.indicators.reduce((s, i) => s + i.spec.weight, 0);
    const csum = g.indicators.reduce((s, i) => s + i.contribution, 0);
    sec(12, "Media ponderada y clasificación",
      "La puntuación final es la media ponderada de los nueve indicadores. Los pesos suman 1 y dan más importancia a la simetría (35 %) que a cada proporción individual.",
      [R`S = \dfrac{\sum_{i=1}^{9} w_i\,s_i}{\sum_{i=1}^{9} w_i}, \qquad \sum w_i = 1`],
      [["Puntuación final S", `${res.score.toFixed(2)} / 100`], ["Clasificación ilustrativa", res.tier.label]],
      [{ headers: ["Indicador", "Peso w", "Puntuación s", "w·s"],
         rows: g.indicators.map((i) => [i.spec.name, i.spec.weight.toFixed(2), i.score.toFixed(2), i.contribution.toFixed(3)])
           .concat([["TOTAL", wsum.toFixed(2), "", csum.toFixed(3)]]) }]);

    // 13
    const q = res.quality;
    sec(13, "Calidad de imagen y reproducibilidad",
      "La nitidez se estima con la varianza del Laplaciano discreto (segunda derivada por diferencias finitas). No se usan números aleatorios: la huella SHA-256 de los píxeles identifica la imagen, y la misma huella siempre produce la misma puntuación.",
      [R`\nabla^2 I_{i,j} \approx I_{i-1,j} + I_{i+1,j} + I_{i,j-1} + I_{i,j+1} - 4\,I_{i,j}`,
       R`\mathrm{Nitidez} = \mathrm{Var}(\nabla^2 I)`],
      [["Varianza del Laplaciano", `${q.sharpness.toFixed(1)}  (umbral ${A.CFG.MIN_SHARPNESS})`],
       ["Brillo medio del rostro", `${q.brightness.toFixed(1)} / 255`],
       ["Contraste (desv. estándar)", q.contrast.toFixed(1)],
       ["Ancho del rostro / ancho de imagen", `${(q.faceFraction * 100).toFixed(1)} %`],
       ["Huella SHA-256 de la imagen", res.imageHash ? res.imageHash.slice(0, 32) + "…" : "no disponible en esta conexión"],
       ["Tiempo de cálculo", `${res.elapsedMs.toFixed(0)} ms`]]);
    return S;
  };
})(window.Armonia = window.Armonia || {});
