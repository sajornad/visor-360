// Versión de un solo archivo para Expo Snack (snack.expo.dev).
// Pégala completa en el App.js del Snack. Se genera desde App.js + viewerHtml.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { DeviceMotion } from 'expo-sensors';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i;

function guessType(name = '', mime = '') {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return VIDEO_EXT.test(name) ? 'video' : 'image';
}

// Los archivos elegidos ya quedan en la caché de la app, así que se usan tal cual.
function ensureInCache(uri) {
  return uri;
}

// Arma la página del visor en memoria. baseUrl es la carpeta común del medio y del audio,
// para que el WebView pueda leer esos archivos locales.
function buildViewerPage(cfg) {
  const dir = (u) => (u && /^file:/.test(u) ? u.slice(0, u.lastIndexOf('/') + 1) : null);
  let base = dir(cfg.src);
  const audioDir = dir(cfg.audioSrc);
  if (base && audioDir) {
    while (!audioDir.startsWith(base)) base = base.slice(0, base.slice(0, -1).lastIndexOf('/') + 1);
  }
  return { html: buildViewerHtml(cfg), baseUrl: base || 'https://unpkg.com/' };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState(null); // { uri, type, name }
  const [audio, setAudio] = useState(null); // { uri, name }
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null); // { page, key }

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert('Error', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const pickPhotos = () => run(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      allowsEditing: false,
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    const type = a.type === 'video' ? 'video' : 'image';
    setMedia({ uri: ensureInCache(a.uri), type, name: a.fileName || (type === 'video' ? 'Video' : 'Imagen') });
  });

  const pickFiles = () => run(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'video/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setMedia({ uri: ensureInCache(a.uri), type: guessType(a.name, a.mimeType), name: a.name });
  });

  const pickAudio = () => run(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setAudio({ uri: ensureInCache(a.uri), name: a.name });
  });

  const useUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      Alert.alert('URL', 'Escribe una dirección que empiece por https://');
      return;
    }
    setMedia({ uri: u, type: guessType(u), name: u });
  };

  const open = () => run(async () => {
    if (!media) return;
    const page = buildViewerPage({
      src: media.uri,
      type: media.type,
      audioSrc: media.type === 'video' && audio ? audio.uri : null,
    });
    setViewer({ page, key: Date.now() });
  });

  if (viewer) {
    return <Viewer key={viewer.key} page={viewer.page} onClose={() => setViewer(null)} />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Visor 360</Text>
        <Text style={styles.subtitle}>Imágenes y videos equirrectangulares (2:1)</Text>

        <Text style={styles.section}>Abrir</Text>
        <Btn
          label="Abrir foto o video 360"
          primary
          onPress={() => setViewer({ page: buildViewerPage({ src: null, type: 'image', audioSrc: null }), key: Date.now() })}
        />
        <View style={styles.urlRow}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://…/panorama.jpg"
            placeholderTextColor="#777"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={useUrl}
          />
          <Btn label="Usar" onPress={useUrl} compact />
        </View>

        {media && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{media.type === 'video' ? 'Video' : 'Imagen'}</Text>
            <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="middle">{media.name}</Text>
          </View>
        )}

        {media?.type === 'video' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Audio aparte (WAV, opcional)</Text>
            {audio ? (
              <>
                <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="middle">{audio.name}</Text>
                <Btn label="Quitar audio" onPress={() => setAudio(null)} subtle />
              </>
            ) : (
              <Btn label="Elegir audio" onPress={pickAudio} subtle />
            )}
          </View>
        )}

        <Btn label="Ver en 360" onPress={open} primary disabled={!media} />

        <Text style={styles.tip}>
          Dentro del visor: arrastra para mirar, pellizca para acercar, toca una vez para ocultar los controles.
          “Giroscopio” mueve la vista con el teléfono.
        </Text>
      </ScrollView>

      {busy && (
        <View style={styles.busy}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.busyTxt}>Preparando…</Text>
        </View>
      )}
    </View>
  );
}

function Viewer({ page, onClose }) {
  const insets = useSafeAreaInsets();
  const web = useRef(null);
  const sub = useRef(null);

  const stopGyro = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
  }, []);

  const gyroFailed = (text) => {
    web.current?.injectJavaScript('window.__gyroOff && window.__gyroOff(); true;');
    Alert.alert('Giroscopio', text);
  };

  const startGyro = useCallback(async () => {
    if (sub.current) return;
    if (!(await DeviceMotion.isAvailableAsync())) return gyroFailed('Este teléfono no tiene sensor de movimiento disponible.');
    const perm = await DeviceMotion.requestPermissionsAsync();
    if (!perm.granted) return gyroFailed('No hay permiso para usar el sensor de movimiento.');
    DeviceMotion.setUpdateInterval(16);
    sub.current = DeviceMotion.addListener(({ rotation: r }) => {
      if (!r || !web.current) return;
      web.current.injectJavaScript(`window.__motion && window.__motion(${r.alpha}, ${r.beta}, ${r.gamma}); true;`);
    });
  }, []);

  useEffect(() => stopGyro, [stopGyro]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => h.remove();
  }, [onClose]);

  const onMessage = (e) => {
    const m = e.nativeEvent.data;
    if (m === 'gyro:on') startGyro();
    else if (m === 'gyro:off') stopGyro();
  };

  return (
    <View style={styles.viewer}>
      <StatusBar hidden />
      <WebView
        ref={web}
        source={{ html: page.html, baseUrl: page.baseUrl }}
        originWhitelist={['*']}
        allowingReadAccessToURL={page.baseUrl}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        onMessage={onMessage}
        style={styles.viewer}
      />
      <Pressable onPress={onClose} style={[styles.back, { top: insets.top + 8, left: insets.left + 12 }]}>
        <Text style={styles.backTxt}>‹ Volver</Text>
      </Pressable>
    </View>
  );
}

function Btn({ label, onPress, primary, subtle, compact, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        primary && styles.btnPrimary,
        subtle && styles.btnSubtle,
        compact && styles.btnCompact,
        disabled && styles.btnDisabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.btnTxt, primary && styles.btnTxtPrimary]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d0f' },
  content: { padding: 20, gap: 12 },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 8 },
  subtitle: { color: '#aaa', fontSize: 15, marginBottom: 8 },
  section: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 8 },
  urlRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, minWidth: 0, color: '#fff', backgroundColor: '#1c1c20', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#2c2c32',
  },
  card: { backgroundColor: '#17171a', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#26262b' },
  cardLabel: { color: '#888', fontSize: 13 },
  cardName: { color: '#fff', fontSize: 16 },
  btn: {
    backgroundColor: '#1f1f24', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2f2f36',
  },
  btnPrimary: { backgroundColor: '#fff', borderColor: '#fff', marginTop: 8 },
  btnSubtle: { paddingVertical: 10 },
  btnCompact: { paddingVertical: 12, paddingHorizontal: 18 },
  btnDisabled: { opacity: 0.35 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnTxtPrimary: { color: '#000' },
  tip: { color: '#777', fontSize: 13, lineHeight: 19, marginTop: 8 },
  busy: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.6)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  busyTxt: { color: '#fff', fontSize: 15 },
  viewer: { flex: 1, backgroundColor: '#000' },
  back: {
    position: 'absolute', backgroundColor: 'rgba(0,0,0,.55)', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  backTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

// ---------- Visor (página HTML con three.js) ----------
// Página del visor 360 que corre dentro del WebView.
// Usa three.js para proyectar la imagen o el video equirrectangular en una esfera.
// cfg = { src, type: 'image' | 'video', audioSrc?: string | null }

function buildViewerHtml(cfg) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; touch-action: none;
    font-family: -apple-system, Roboto, sans-serif; color: #fff; -webkit-user-select: none; user-select: none; }
  canvas { display: block; }
  #msg { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 32px; box-sizing: border-box; font-size: 15px; line-height: 1.4;
    pointer-events: none; overflow-wrap: anywhere; }
  #bar { position: fixed; left: 0; right: 0; bottom: 0; box-sizing: border-box;
    padding: 24px 12px calc(12px + env(safe-area-inset-bottom));
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    background: linear-gradient(transparent, rgba(0,0,0,.75)); }
  button { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.35);
    border-radius: 18px; padding: 8px 12px; font-size: 14px; white-space: nowrap; max-width: 100%;
    overflow: hidden; text-overflow: ellipsis; }
  button.on { background: #fff; color: #000; }
  #seekRow { display: flex; align-items: center; gap: 8px; flex: 1 1 100%; min-width: 0; }
  #seek { flex: 1 1 auto; min-width: 0; }
  #time { font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; flex: 0 0 auto; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<div id="msg">Cargando…</div>
<div id="vrline" class="hidden" style="position:fixed;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#333;pointer-events:none"></div>
<div id="bar">
  <div id="seekRow" class="hidden">
    <button id="play">▶</button>
    <input id="seek" type="range" min="0" max="1000" value="0">
    <span id="time">0:00 / 0:00</span>
  </div>
  <button id="mute" class="hidden">Sonido: sí</button>
  <button id="gyro">Giroscopio</button>
  <button id="fmt">Formato: Mono</button>
  <button id="reset">Centrar</button>
  <button id="vr">Cardboard</button>
</div>
<script>window.__CFG = ${json};</script>
<script type="module">
import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';

const CFG = window.__CFG;
const $ = (id) => document.getElementById(id);
const msg = $('msg'), bar = $('bar'), playBtn = $('play'), seek = $('seek'), timeEl = $('time');
const muteBtn = $('mute'), gyroBtn = $('gyro'), fmtBtn = $('fmt'), resetBtn = $('reset');

function say(t) { msg.textContent = t || ''; msg.style.display = t ? 'flex' : 'none'; }
function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); }
const clamp = THREE.MathUtils.clamp;

// ---------- Escena ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false }); }
catch (err) { say('Este navegador no puede mostrar 3D (WebGL): ' + err.message); throw err; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1100);
const geo = new THREE.SphereGeometry(500, 64, 32);
geo.scale(-1, 1, 1); // ver la esfera por dentro
const mat = new THREE.MeshBasicMaterial();
const sphere = new THREE.Mesh(geo, mat);
sphere.rotation.y = -Math.PI / 2; // el centro de la imagen queda al frente
sphere.visible = false;
scene.add(sphere);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- Formatos (mono / estéreo) ----------
const FORMATS = [
  { label: 'Mono',         r: [1, 1],   o: [0, 0],   o2: [0, 0] },
  { label: 'Arriba/abajo', r: [1, 0.5], o: [0, 0.5], o2: [0, 0] }, // izquierdo arriba, derecho abajo
  { label: 'Lado a lado',  r: [0.5, 1], o: [0, 0],   o2: [0.5, 0] }, // izquierdo a la izquierda
];
let fmtIdx = 0;
function applyFormat() {
  const f = FORMATS[fmtIdx];
  if (mat.map) { mat.map.repeat.set(f.r[0], f.r[1]); mat.map.offset.set(f.o[0], f.o[1]); }
  fmtBtn.textContent = 'Formato: ' + f.label;
}
fmtBtn.onclick = () => { fmtIdx = (fmtIdx + 1) % FORMATS.length; applyFormat(); };

function setTexture(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  mat.map = tex;
  mat.needsUpdate = true;
  sphere.visible = true;
  applyFormat();
}

// ---------- Carga del medio ----------
const isRemote = () => /^https?:/i.test(CFG.src || '');
let video = null, audio = null, seeking = false;

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function loadMedia() {
if (CFG.type === 'video') {
  $('seekRow').classList.remove('hidden');
  muteBtn.classList.remove('hidden');

  video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.playsInline = true;
  video.loop = true;
  video.preload = 'auto';
  if (isRemote()) video.crossOrigin = 'anonymous';
  video.src = CFG.src;

  if (CFG.audioSrc) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.src = CFG.audioSrc;
    video.muted = true; // el sonido sale del WAV aparte
  }

  say('Toca ▶ para reproducir');
  let textured = false;
  const onReady = () => {
    if (!textured) { setTexture(new THREE.VideoTexture(video)); textured = true; }
    if (!video.paused || video.currentTime > 0) say('');
    updateTime();
  };
  video.addEventListener('loadeddata', onReady);
  video.addEventListener('error', () => say(
    'El teléfono no pudo reproducir este video. Si es 6K en H.265, prueba con una copia en 4K (3840×1920).'));
  video.addEventListener('timeupdate', updateTime);

  const syncAudio = (force) => {
    if (!audio) return;
    if (force || Math.abs(audio.currentTime - video.currentTime) > 0.15) {
      try { audio.currentTime = video.currentTime; } catch (e) {}
    }
  };
  video.addEventListener('play', () => { playBtn.textContent = '❚❚'; say(''); });
  video.addEventListener('playing', () => { if (audio) { syncAudio(true); audio.play().catch(() => {}); } });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; if (audio) audio.pause(); });
  video.addEventListener('waiting', () => { if (audio) audio.pause(); });
  video.addEventListener('seeked', () => syncAudio(true));
  setInterval(() => { if (audio && !video.paused) syncAudio(false); }, 1000);

  playBtn.onclick = () => {
    if (video.paused) video.play().catch((e) => say('No se pudo reproducir: ' + e.message));
    else video.pause();
  };
  seek.addEventListener('input', () => {
    seeking = true;
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
  });
  seek.addEventListener('change', () => { seeking = false; });

  let muted = false;
  muteBtn.onclick = () => {
    muted = !muted;
    if (audio) audio.muted = muted; else video.muted = muted;
    muteBtn.textContent = 'Sonido: ' + (muted ? 'no' : 'sí');
  };
  video.load();
} else {
  const img = new Image();
  if (isRemote()) img.crossOrigin = 'anonymous';
  img.onload = () => { const t = new THREE.Texture(img); t.needsUpdate = true; setTexture(t); say(''); };
  img.onerror = () => say('No se pudo abrir la imagen.' + (isRemote() ? ' El servidor debe permitir CORS.' : ''));
  img.src = CFG.src;
}
}

function updateTime() {
  if (!video) return;
  const d = video.duration || 0;
  timeEl.textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(d);
  if (!seeking && d) seek.value = String(Math.round((video.currentTime / d) * 1000));
}

// ---------- Mirada: arrastre, pellizco y giroscopio ----------
let yaw = 0, pitch = 0;
let gyroOn = false, gyroOffset = 0, needGyroInit = false, motion = null;
const fwd = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0), zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler(), dq = new THREE.Quaternion(), q0 = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // la cámara mira por detrás del teléfono

// La app nativa manda la orientación del teléfono (radianes).
window.__motion = function (a, b, g) { motion = { a: a, b: b, g: g }; };
window.__gyroOff = function () { setGyro(false, true); };

function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  return window.orientation || 0;
}
function deviceQuat(m, out) {
  euler.set(m.b, m.a, -m.g, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(q1);
  out.multiply(q0.setFromAxisAngle(zee, -THREE.MathUtils.degToRad(screenAngle())));
  return out;
}
function setGyro(on, silent) {
  if (on === gyroOn) return;
  gyroOn = on;
  gyroBtn.classList.toggle('on', on);
  if (on) { needGyroInit = true; motion = null; if (!silent) post('gyro:on'); }
  else {
    camera.getWorldDirection(fwd);
    yaw = Math.atan2(fwd.x, -fwd.z);
    pitch = Math.asin(clamp(fwd.y, -1, 1));
    if (!silent) post('gyro:off');
  }
}
gyroBtn.onclick = () => setGyro(!gyroOn);
resetBtn.onclick = () => {
  yaw = 0; pitch = 0; camera.fov = 75; camera.updateProjectionMatrix();
  if (gyroOn) needGyroInit = true;
};

const cv = renderer.domElement;
const pts = new Map();
let pinch = null, tap = null;
function pinchDist() {
  const a = Array.from(pts.values());
  return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
}
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) tap = { x: e.clientX, y: e.clientY, t: Date.now() };
  if (pts.size === 2) { pinch = { d: pinchDist(), fov: camera.fov }; tap = null; }
});
cv.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 2 && pinch) {
    camera.fov = clamp(pinch.fov * pinch.d / Math.max(pinchDist(), 1), 30, 100);
    camera.updateProjectionMatrix();
    return;
  }
  if (pts.size === 1) {
    const k = 0.004 * camera.fov / 75;
    if (gyroOn) gyroOffset += dx * k;
    else { yaw -= dx * k; pitch = clamp(pitch + dy * k, -1.48, 1.48); }
  }
});
function endPointer(e) {
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (tap && pts.size === 0) {
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    if (moved < 8 && Date.now() - tap.t < 300) bar.classList.toggle('hidden');
    tap = null;
  }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);


// ---------- Modo Cardboard (pantalla dividida, una vista por ojo) ----------
const vrBtn = $('vr'), vrLine = $('vrline');
let vr = false, fovBeforeVr = 75, wasLandscape = null;
vrBtn.onclick = () => {
  vr = !vr;
  vrBtn.classList.toggle('on', vr);
  vrBtn.textContent = vr ? 'Salir de Cardboard' : 'Cardboard';
  vrLine.classList.toggle('hidden', !vr);
  const ttl = document.getElementById('ttl'); if (ttl) ttl.style.display = vr ? 'none' : '';
  wasLandscape = null;
  if (vr) {
    fovBeforeVr = camera.fov;
    camera.fov = 90;
    setGyro(true);
    bar.classList.add('hidden');
    const home = document.getElementById('home'); if (home) home.classList.add('hidden');
  } else {
    camera.fov = fovBeforeVr;
    camera.aspect = window.innerWidth / window.innerHeight;
    say('');
  }
  camera.updateProjectionMatrix();
};
function renderFrame() {
  if (!vr) { renderer.render(scene, camera); return; }
  const w = window.innerWidth, h = window.innerHeight, f = FORMATS[fmtIdx];
  const landscape = w > h;
  if (landscape !== wasLandscape) { wasLandscape = landscape; say(landscape ? '' : 'Gira el teléfono en horizontal y ponlo en las gafas'); }
  camera.aspect = (w / 2) / h;
  camera.updateProjectionMatrix();
  renderer.setScissorTest(true);
  for (let eye = 0; eye < 2; eye++) {
    if (mat.map) { const o = eye ? f.o2 : f.o; mat.map.offset.set(o[0], o[1]); }
    renderer.setViewport(eye * w / 2, 0, w / 2, h);
    renderer.setScissor(eye * w / 2, 0, w / 2, h);
    renderer.render(scene, camera);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  if (mat.map) mat.map.offset.set(f.o[0], f.o[1]);
}

renderer.setAnimationLoop(() => {
  if (gyroOn) {
    if (motion) {
      deviceQuat(motion, dq);
      if (needGyroInit) {
        fwd.set(0, 0, -1).applyQuaternion(dq);
        gyroOffset = Math.atan2(fwd.x, -fwd.z) - yaw; // mantener hacia dónde miraba
        needGyroInit = false;
      }
      camera.quaternion.copy(qYaw.setFromAxisAngle(yAxis, gyroOffset)).multiply(dq);
    }
  } else {
    fwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(fwd);
  }
  renderFrame();
});
// ---------- Selector de archivo dentro del visor ----------
// iOS no deja al WebView leer fotos de la app, así que el archivo se elige aquí.
const picker = document.createElement('div');
picker.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px;box-sizing:border-box;text-align:center';
const btnCss = 'display:block;width:100%;max-width:320px;box-sizing:border-box;padding:16px;border-radius:14px;font-size:17px;font-weight:600;overflow-wrap:anywhere;';
picker.innerHTML =
  '<label style="' + btnCss + 'background:#fff;color:#000">Elegir foto o video 360<input id="fi" type="file" accept="image/*,video/*" style="display:none"></label>' +
  '<label style="' + btnCss + 'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.35)">Audio aparte (opcional)<input id="fa" type="file" accept="audio/*" style="display:none"></label>' +
  '<div id="an" style="font-size:14px;color:#aaa;max-width:320px;overflow-wrap:anywhere"></div>';
document.body.appendChild(picker);
let pickedAudio = null;
$('fa').onchange = (ev) => {
  const f = ev.target.files[0];
  if (f) { pickedAudio = URL.createObjectURL(f); $('an').textContent = 'Audio: ' + f.name; }
};
$('fi').onchange = (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  CFG.src = URL.createObjectURL(f);
  CFG.type = /^video/.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name) ? 'video' : 'image';
  CFG.audioSrc = CFG.type === 'video' ? pickedAudio : null;
  picker.remove();
  say('Cargando…');
  loadMedia();
};
if (CFG.src) { picker.remove(); loadMedia(); } else { say(''); }
</script>
</body>
</html>`;
}
