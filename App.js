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
import { buildViewerHtml } from './viewerHtml';

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
        <Btn label="Elegir de Fotos" onPress={pickPhotos} />
        <Btn label="Elegir de Archivos" onPress={pickFiles} />
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
