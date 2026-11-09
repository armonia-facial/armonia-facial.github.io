/* Armonía Facial móvil — configuración (copia fiel de armonia/config.py y landmarks.py). */
"use strict";
(function (A) {
  const PHI = (1 + Math.sqrt(5)) / 2;

  A.CFG = {
    MP_VERSION: "1.1.1",
    MAX_FILE_MB: 30,
    MIN_IMAGE_SIDE: 200,
    MAX_PROCESS_SIDE: 1600,
    MIN_FACE_WIDTH_FRACTION: 0.10,
    MIN_SHARPNESS: 30,
    MIN_BRIGHTNESS: 50,
    MAX_BRIGHTNESS: 215,
    MAX_YAW_DEG: 12,
    MAX_PITCH_DEG: 15,
    MAX_ROLL_DEG: 25,
    PHI,
    // Rutas de los recursos pesados (el servidor local o la publicación las cambian)
    modelUrl: (window.ARMONIA_RUTAS && window.ARMONIA_RUTAS.modelo) || "face_landmarker.task",
    wasmBinary: (window.ARMONIA_RUTAS && window.ARMONIA_RUTAS.wasm) || null,
  };

  const SYM = "Simetría", PROP = "Proporciones";
  A.INDICATORS = [
    { key: "sym_reflection", name: "Simetría bilateral (reflexión)", group: SYM, weight: 0.22, ideal: 0.0, sigma: 0.03,
      description: "Se refleja cada punto del lado izquierdo respecto al eje medio ajustado por mínimos cuadrados y se mide la distancia euclidiana a su par del lado derecho, normalizada por la distancia interpupilar. Un rostro perfectamente simétrico daría 0.",
      reference: "Grammer & Thornhill (1994); Rhodes (2006)" },
    { key: "sym_area", name: "Simetría de áreas (hemicaras)", group: SYM, weight: 0.13, ideal: 1.0, sigma: 0.04,
      description: "Se recorta el contorno facial con el eje medio y se calcula el área de cada mitad con la fórmula de Gauss (shoelace). El indicador es el cociente área menor / área mayor (ideal = 1).",
      reference: "Fórmula del área de Gauss / teorema de Green" },
    { key: "fifths", name: "Regla de los quintos", group: PROP, weight: 0.12, ideal: 0.0, sigma: 0.22,
      description: "A la altura de los ojos el ancho del rostro debería dividirse en cinco segmentos iguales (un ancho de ojo cada uno). Se mide el coeficiente de variación CV = σ/μ de los cinco segmentos (ideal = 0).",
      reference: "Canon neoclásico (Farkas et al., 1985)" },
    { key: "nose_intercanthal", name: "Ancho nasal / distancia intercantal", group: PROP, weight: 0.10, ideal: 1.0, sigma: 0.25,
      description: "El ancho de la nariz (entre alas nasales) debería ser igual a la distancia entre los ángulos internos de los ojos.",
      reference: "Canon neoclásico (Farkas et al., 1985)" },
    { key: "mouth_nose", name: "Ancho de boca / ancho nasal", group: PROP, weight: 0.10, ideal: PHI, sigma: 0.15,
      description: "El ancho de la boca (entre comisuras) se compara con la razón áurea φ multiplicada por el ancho nasal.",
      reference: "Proporción áurea en estética facial (Ricketts, 1982)" },
    { key: "thirds", name: "Tercio medio / tercio inferior", group: PROP, weight: 0.10, ideal: 1.0, sigma: 0.15,
      description: "Distancia glabela–subnasal comparada con la distancia subnasal–mentón. En el canon clásico ambos tercios son iguales.",
      reference: "Canon de los tercios faciales (Vitruvio; Farkas)" },
    { key: "lower_third", name: "Subdivisión del tercio inferior", group: PROP, weight: 0.08, ideal: 0.5, sigma: 0.22,
      description: "Distancia subnasal–estomion dividida entre estomion–mentón. El labio superior ocupa idealmente 1/3 del tercio inferior (razón 1:2).",
      reference: "Análisis cefalométrico de tejidos blandos" },
    { key: "ipd_width", name: "Distancia interpupilar / ancho facial", group: PROP, weight: 0.08, ideal: 0.46, sigma: 0.12,
      description: "Pallett, Link y Lee (2010) encontraron que los rostros se perciben más armónicos cuando la distancia entre pupilas es cercana al 46 % del ancho del rostro.",
      reference: "Pallett, Link & Lee, Vision Research 50 (2010)" },
    { key: "eye_mouth_length", name: "Distancia ojos–boca / largo facial", group: PROP, weight: 0.07, ideal: 0.36, sigma: 0.15,
      description: "Distancia vertical entre la línea de las pupilas y la boca, dividida entre el largo del rostro. El estudio de Pallett et al. reporta un valor ideal cercano al 36 %.",
      reference: "Pallett, Link & Lee, Vision Research 50 (2010)" },
  ];
  A.INDICATOR_BY_KEY = Object.fromEntries(A.INDICATORS.map((s) => [s.key, s]));

  A.TIERS = [
    { min: 85, label: "Armonía geométrica muy alta", stars: 5, comment: "Las medidas están muy cerca de los cánones geométricos usados." },
    { min: 72, label: "Armonía geométrica alta", stars: 4, comment: "La mayoría de las proporciones coinciden con los cánones." },
    { min: 58, label: "Armonía geométrica media", stars: 3, comment: "Proporciones equilibradas con algunas diferencias respecto al canon." },
    { min: 42, label: "Armonía geométrica moderada", stars: 2, comment: "Varias medidas se alejan del canon; esto describe rasgos distintivos." },
    { min: 0, label: "Proporciones distintivas", stars: 1, comment: "El rostro se aparta del modelo geométrico, lo cual no es un juicio de valor: el canon es solo una convención matemática." },
  ];
  A.tierFor = (score) => A.TIERS.find((t) => score >= t.min) || A.TIERS[A.TIERS.length - 1];

  A.DISCLAIMER = "La belleza es subjetiva y depende de la cultura, la época y la persona que observa. Este programa NO determina si alguien es guapo o feo: solo mide qué tanto se acercan algunas proporciones geométricas del rostro a cánones matemáticos (simetría, regla de tercios y quintos, razón áurea). La puntuación también depende de la pose, la iluminación y la lente de la cámara. Es un ejercicio académico de métodos numéricos.";

  // Carátula y encabezado (modelo de informes de la UNIFSLB)
  A.UNIVERSIDAD_CARATULA = ["UNIVERSIDAD NACIONAL INTERCULTURAL", "“FABIOLA SALAZAR LEGUÍA” DE BAGUA"];
  A.UNIVERSIDAD_ENCABEZADO = ["Universidad Nacional Intercultural", "“Fabiola Salazar Leguía” de Bagua", "Ley de Creación N° 29614"];
  A.FACULTAD = "FACULTAD DE INGENIERÍAS";
  A.ESCUELA = "ESCUELA PROFESIONAL DE INGENIERÍA CIVIL";
  A.REPORT_DEFAULTS = {
    autor: "Walter Eto’o Chapoñan Rojas",
    codigo: "2421010205",
    docente: "Dr. Ronald Omar Estela Urbina",
    titulo: "INFORME DEL CURSO DE MÉTODOS NUMÉRICOS",
    subtitulo: "Análisis geométrico de la armonía facial",
    encabezado_trabajo: "PROYECTO DEL CURSO DE MÉTODOS NUMÉRICOS",
    lema_anio: "“AÑO DE LA ESPERANZA Y EL FORTALECIMIENTO DE LA DEMOCRACIA”",
    lugar: "BAGUA-PERÚ",
    anio: "2026",
    ...(window.ARMONIA_INFORME_DEFECTO || {}),
  };
  A.REPORT_FIELDS = [
    ["autor", "Autor(a)"], ["codigo", "Código de estudiante"], ["docente", "Profesor(a)"],
    ["titulo", "Título en la carátula"], ["subtitulo", "Subtítulo"],
    ["encabezado_trabajo", "Texto del encabezado"], ["lema_anio", "Nombre del año"],
    ["lugar", "Lugar"], ["anio", "Año"],
  ];
  const TITULOS = new Set(["dr", "dra", "mg", "msc", "m.sc", "ing", "lic", "mtro", "mtra", "phd", "arq", "econ"]);
  A.nombreSinTitulos = (n) => n.replace(/,/g, " ").split(/\s+/).filter((p) => p && !TITULOS.has(p.toLowerCase().replace(/\.$/, ""))).join(" ").toUpperCase();

  // ---------------------------------------------------------------- malla MediaPipe
  const L = {};
  L.NUM = 478;
  L.FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  L.MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 152];
  L.RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  L.LEFT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
  L.RIGHT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
  L.LEFT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
  L.LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  L.LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  L.RIGHT_IRIS = [469, 470, 471, 472];
  L.LEFT_IRIS = [474, 475, 476, 477];
  Object.assign(L, {
    TOP_FOREHEAD: 10, GLABELLA: 9, NASION: 168, NOSE_TIP: 1, SUBNASALE: 2,
    UPPER_LIP_INNER: 13, LOWER_LIP_INNER: 14, MENTON: 152,
    R_EYE_OUTER: 33, R_EYE_INNER: 133, L_EYE_INNER: 362, L_EYE_OUTER: 263,
    R_MOUTH: 61, L_MOUTH: 291, R_FACE_EDGE: 234, L_FACE_EDGE: 454,
    R_ALA_CANDIDATES: [64, 98, 129, 48, 49, 102],
    L_ALA_CANDIDATES: [294, 327, 358, 278, 279, 331],
  });
  const zip = (a, b) => a.map((v, i) => [v, b[i]]);
  const OVAL_LEFT = L.FACE_OVAL.slice(1, 18);
  const OVAL_RIGHT = [];
  for (let i = 35; i > 18; i--) OVAL_RIGHT.push(L.FACE_OVAL[i]);
  L.SYMMETRIC_PAIRS = [
    ["Contorno", zip(OVAL_RIGHT, OVAL_LEFT)],
    ["Ojos", zip(L.RIGHT_EYE, L.LEFT_EYE)],
    ["Cejas", zip(L.RIGHT_EYEBROW, L.LEFT_EYEBROW)],
    ["Nariz", [[64, 294], [98, 327], [129, 358], [48, 278], [49, 279], [102, 331], [115, 344], [220, 440], [45, 275], [97, 326]]],
    ["Boca", [[61, 291], [185, 409], [40, 270], [39, 269], [37, 267], [146, 375], [91, 321], [181, 405], [84, 314], [78, 308], [81, 311], [82, 312], [87, 317], [88, 318], [95, 324], [178, 402]]],
    ["Mejillas", [[50, 280], [205, 425], [187, 411], [123, 352], [116, 345], [117, 346], [118, 347], [101, 330], [36, 266], [206, 426], [207, 427], [147, 376], [192, 416], [213, 433]]],
  ];
  L.ALL_PAIRS = L.SYMMETRIC_PAIRS.flatMap(([, pairs]) => pairs);
  A.L = L;
})(window.Armonia = window.Armonia || {});
