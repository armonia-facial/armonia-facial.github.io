/* Carga de imágenes, detección con MediaPipe (en el propio teléfono) y control de calidad. */
"use strict";
(function (A) {
  const { CFG, NM } = A;
  let landmarker = null, landmarkerPromise = null, visionLib = null;

  class UserError extends Error {
    constructor(title, message) { super(message); this.title = title; }
  }
  A.UserError = UserError;

  /** Carga MediaPipe Tasks Vision (WASM) y el modelo; se hace una sola vez. */
  A.loadDetector = function (onStatus) {
    if (landmarkerPromise) return landmarkerPromise;
    landmarkerPromise = (async () => {
      // En el APK el motor viene incluido (ARMONIA_RUTAS.mpBase); en la web se usa el CDN.
      const rutaMp = (window.ARMONIA_RUTAS && window.ARMONIA_RUTAS.mpBase) ||
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CFG.MP_VERSION}`;
      const base = new URL(rutaMp, document.baseURI).href.replace(/\/$/, "");
      onStatus && onStatus("Cargando el motor de visión…");
      visionLib = await import(`${base}/vision_bundle.mjs`);
      const { FaceLandmarker, FilesetResolver } = visionLib;
      let fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`);
      if (CFG.wasmBinary) fileset = { ...fileset, wasmBinaryPath: CFG.wasmBinary };
      onStatus && onStatus("Cargando el modelo de 478 puntos…");
      const resp = await fetch(CFG.modelUrl);
      if (!resp.ok) throw new UserError("Modelo no encontrado", "No se pudo descargar el modelo de MediaPipe (face_landmarker.task).");
      const buffer = new Uint8Array(await resp.arrayBuffer());
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 5,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        outputFacialTransformationMatrixes: true,
      });
      A.TESSELATION = FaceLandmarker.FACE_LANDMARKS_TESSELATION || [];
      return landmarker;
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
    return landmarkerPromise;
  };

  /** Valida y carga un archivo como lienzo RGB reescalado (lado máximo 1600 px). */
  A.loadImageFile = async function (file) {
    if (!file) throw new UserError("Sin imagen", "No se seleccionó ninguna fotografía.");
    const okType = /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name || "");
    if (!okType) throw new UserError("Formato no admitido", "Use una imagen JPG, JPEG o PNG.");
    if (file.size === 0) throw new UserError("Archivo vacío", "El archivo está vacío.");
    if (file.size > CFG.MAX_FILE_MB * 1024 * 1024)
      throw new UserError("Archivo muy grande", `El archivo pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${CFG.MAX_FILE_MB} MB.`);
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      throw new UserError("Imagen dañada", "No se pudo leer la imagen; el archivo puede estar dañado.");
    }
    return A.bitmapToCanvas(bmp, file.name || "foto");
  };

  A.bitmapToCanvas = function (bmp, name) {
    const w0 = bmp.width, h0 = bmp.height;
    if (Math.min(w0, h0) < CFG.MIN_IMAGE_SIDE)
      throw new UserError("Imagen muy pequeña", `La imagen mide ${w0}×${h0} px. El lado menor debe tener al menos ${CFG.MIN_IMAGE_SIDE} px.`);
    const s = Math.max(w0, h0) > CFG.MAX_PROCESS_SIDE ? CFG.MAX_PROCESS_SIDE / Math.max(w0, h0) : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { canvas: c, name, originalSize: [w0, h0], scale: s };
  };

  function grayOf(ctx, x, y, w, h) {
    const d = ctx.getImageData(x, y, w, h).data;
    const g = new Float64Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
    return g;
  }

  async function sha256Hex(canvas) {
    if (!(window.crypto && crypto.subtle)) return null; // requiere conexión segura (https)
    const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const rgb = new Uint8Array((d.length / 4) * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    const buf = await crypto.subtle.digest("SHA-256", rgb);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Pipeline completo: detección → calidad → geometría → puntuación. */
  A.analyze = async function (img, onStatus) {
    const lm = await A.loadDetector(onStatus);
    const t0 = performance.now(); // sin contar la descarga del motor y del modelo
    onStatus && onStatus("Detectando el rostro…");
    const { canvas } = img;
    const W = canvas.width, H = canvas.height;
    const result = lm.detect(canvas);
    const faces = result.faceLandmarks || [];
    if (!faces.length)
      throw new UserError("No se detectó ningún rostro", "Use una fotografía frontal donde la cara se vea completa y con buena luz.");
    let k = 0, best = -1;
    faces.forEach((f, i) => {
      const xs = f.map((p) => p.x), ys = f.map((p) => p.y);
      const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (a > best) { best = a; k = i; }
    });
    const norm = faces[k].map((p) => [p.x, p.y, p.z]);
    const px = norm.map(([x, y]) => [x * W, y * H]);
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
    const bbox = [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), 0, 0];
    bbox[2] = Math.ceil(Math.max(...xs)) - bbox[0]; bbox[3] = Math.ceil(Math.max(...ys)) - bbox[1];
    const det = { pointsPx: px, pointsNorm: norm, numFaces: faces.length, bbox, yaw: null, pitch: null, roll: null };
    const mats = result.facialTransformationMatrixes || [];
    if (mats[k] && mats[k].data) {
      const m = mats[k].data; // matriz 4×4 de MediaPipe (orden por columnas)
      const R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
      [det.yaw, det.pitch, det.roll] = NM.eulerFromMatrix(R);
    }
    const warnings = [];
    if (faces.length > 1) warnings.push(`Se detectaron ${faces.length} rostros; se analiza el de mayor tamaño.`);
    if (bbox[0] < 0 || bbox[1] < 0 || bbox[0] + bbox[2] > W || bbox[1] + bbox[3] > H)
      warnings.push("Parte del rostro queda fuera de la imagen; las medidas pueden ser imprecisas.");

    onStatus && onStatus("Evaluando la calidad de la imagen…");
    const x0 = Math.max(0, bbox[0]), y0 = Math.max(0, bbox[1]);
    const cw = Math.max(1, Math.min(W, bbox[0] + bbox[2]) - x0), ch = Math.max(1, Math.min(H, bbox[1] + bbox[3]) - y0);
    let qc = document.createElement("canvas");
    const sc = cw > 256 ? 256 / cw : 1;
    qc.width = Math.max(3, Math.round(cw * sc)); qc.height = Math.max(3, Math.round(ch * sc));
    const qctx = qc.getContext("2d", { willReadFrequently: true });
    qctx.imageSmoothingQuality = "high";
    qctx.drawImage(canvas, x0, y0, cw, ch, 0, 0, qc.width, qc.height);
    const gray = grayOf(qctx, 0, 0, qc.width, qc.height);
    const gm = NM.mean(Array.from(gray));
    const quality = {
      sharpness: NM.laplacianVariance(gray, qc.width, qc.height),
      brightness: gm,
      contrast: Math.sqrt(gray.reduce((s, v) => s + (v - gm) * (v - gm), 0) / gray.length),
      faceFraction: bbox[2] / W,
    };
    if (quality.faceFraction < CFG.MIN_FACE_WIDTH_FRACTION) warnings.push("El rostro ocupa muy poco de la imagen; acérquese o recorte la foto.");
    if (quality.sharpness < CFG.MIN_SHARPNESS) warnings.push(`La imagen parece desenfocada (varianza del Laplaciano = ${quality.sharpness.toFixed(0)} < ${CFG.MIN_SHARPNESS}).`);
    if (quality.brightness < CFG.MIN_BRIGHTNESS) warnings.push("El rostro está poco iluminado; los puntos pueden ser imprecisos.");
    else if (quality.brightness > CFG.MAX_BRIGHTNESS) warnings.push("El rostro está sobreexpuesto (demasiado brillo).");
    if (det.yaw != null && Math.abs(det.yaw) > CFG.MAX_YAW_DEG)
      warnings.push(`Cabeza girada lateralmente ≈ ${Math.abs(det.yaw).toFixed(0)}°; la simetría medida será menor que la real. Use una foto frontal.`);
    if (det.pitch != null && Math.abs(det.pitch) > CFG.MAX_PITCH_DEG)
      warnings.push(`Cabeza inclinada arriba/abajo ≈ ${Math.abs(det.pitch).toFixed(0)}°; las proporciones verticales pueden alterarse.`);

    onStatus && onStatus("Calculando distancias, simetría y proporciones…");
    const geometry = A.computeGeometry(px);
    const rollDeg = Math.abs(geometry.rollRad * 180 / Math.PI);
    if (rollDeg > CFG.MAX_ROLL_DEG) warnings.push(`La cabeza está inclinada ${rollDeg.toFixed(0)}°; se corrigió por rotación, pero conviene una foto más recta.`);
    const score = Math.min(100, Math.max(0, geometry.finalScore));
    const imageHash = await sha256Hex(canvas);
    return {
      name: img.name, canvas, width: W, height: H, originalSize: img.originalSize,
      detection: det, geometry, quality, warnings, score, tier: A.tierFor(score),
      elapsedMs: performance.now() - t0, imageHash, timestamp: new Date(),
    };
  };
})(window.Armonia = window.Armonia || {});
