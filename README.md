# Visor 360 (Expo Go)

App para ver fotos y videos 360 equirrectangulares (2:1) en el teléfono, con giroscopio, arrastre, zoom con pellizco y audio WAV aparte sincronizado con el video.

## Montarla (una sola vez)

Necesitas Node.js en el computador y la app **Expo Go** en el teléfono.

```bash
git clone https://github.com/sajornad/visor-360
cd visor-360
npm install
npx expo install --fix
npx expo start
```

Escanea el código QR con la cámara del iPhone (abre Expo Go).

Archivos:
- `App.js`: pantalla de inicio (elegir foto/video/URL/audio) y pantalla del visor.
- `viewerHtml.js`: página HTML con three.js que proyecta la imagen o el video en una esfera.

Si el teléfono y el computador no están en la misma red Wi-Fi, usa `npx expo start --tunnel`.

## Uso

- **Elegir de Fotos / Elegir de Archivos**: abre una imagen o un video 360 del teléfono.
- **URL**: pega un enlace `https://` a un .jpg o .mp4. El servidor debe permitir CORS.
- **Audio aparte (WAV)**: si elegiste un video, puedes agregarle su WAV. El video se silencia y el WAV suena sincronizado.
- **En el visor**: arrastra para mirar, pellizca para hacer zoom y toca una vez para ocultar o mostrar los controles.
  - **Giroscopio**: la vista sigue los movimientos del teléfono.
  - **Formato**: Mono, Arriba/abajo o Lado a lado. Con las dos opciones estéreo ves solo el ojo izquierdo.
  - **Centrar**: vuelve al frente.

## Videos 6K

La mayoría de los teléfonos no decodifican 6K H.265 dentro de un WebView. Si un video no abre, haz una copia en 4K para el teléfono. Este comando también le mete el WAV:

```bash
ffmpeg -i video6k.mp4 -i audio.wav -map 0:v -map 1:a -vf scale=3840:1920 \
  -c:v libx264 -crf 20 -preset veryfast -c:a aac -b:a 192k -shortest -movflags +faststart preview4k.mp4
```

## Notas

- El visor carga three.js desde internet, así que la primera vez necesitas conexión.
- Cuando eliges un archivo, puede que se copie a la caché de la app. Si son videos pesados, la caché crece; el sistema la limpia solo.
- Si en Android el giroscopio se mueve al revés en algún eje, avísame para invertirlo.

## Actualizar el Snack (Expo Go)

El Snack `@sajornad/v360` usa un solo archivo: `snack/App.js`.

1. Abre https://snack.expo.dev/@sajornad/v360 con tu cuenta de Expo.
2. Abre `snack/App.js` en GitHub, toca **Copy raw file** y pégalo reemplazando todo el `App.js` del Snack.
3. Si Snack marca una dependencia faltante, toca **Add dependency** (las versiones están en `snack/package.json`).
4. Toca **Save**. En Expo Go, sacude el teléfono y elige **Reload**.

Si cambias `App.js` o `viewerHtml.js`, vuelve a generar `snack/App.js` (es la unión de los dos archivos).

## Gafas Cardboard

En el visor toca **Cardboard**: la pantalla se divide en dos (una vista por ojo) y se activa el giroscopio. Gira el teléfono en horizontal. Para fotos o videos estéreo elige antes el **Formato** (Arriba/abajo o Lado a lado).
