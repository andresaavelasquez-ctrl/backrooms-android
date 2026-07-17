# Backrooms: No-Clip — Android offline

Port móvil Android del proyecto **Backrooms: No-Clip v30.12**. El juego completo se ejecuta dentro de una WebView con todos sus HTML, JavaScript, audio, sprites y fuentes empaquetados en el APK.

## Qué cambia respecto al proyecto web

- La aplicación **no declara `android.permission.INTERNET`**.
- WebView tiene bloqueadas las cargas de red mediante `setBlockNetworkLoads(true)`.
- El cliente fuerza siempre `window.MODO_LOCAL = true`; nunca crea una conexión WebSocket.
- El servidor de juego se ejecuta dentro de la propia WebView mediante `game/js/net/local.js`.
- Se conserva la expedición local por perfil: posición, nivel, salud, inventario, equipo, entidades y salidas abiertas.
- Interfaz adaptada a pantalla táctil, orientación horizontal e inmersión a pantalla completa.
- Los enlaces externos de la wiki se bloquean dentro del APK.

## Fuente del juego

La compilación descarga una copia fijada del upstream:

- Repositorio: `AgenteMaxo/backrooms-noclip`
- Commit: `351731ca6746b5a6cc5d8d57e4093fb6617f96ad`
- Versión: `v30.12`

Fijar el commit hace que la compilación sea reproducible y evita cambios inesperados del upstream.

## Compilar en GitHub Actions

Abre **Actions → Build Backrooms Offline APK → Run workflow**. Al terminar, descarga el artefacto `backrooms-noclip-offline-apk`.

## Compilar localmente

Requisitos: JDK 17, Android SDK 36, Build Tools 35.0.0 y Gradle 8.13.

```bash
bash mobile/prepare-web.sh
gradle --no-daemon -p mobile :app:assembleDebug
```

El APK se genera en:

```text
mobile/app/build/outputs/apk/debug/app-debug.apk
```

## Estructura

```text
mobile/
  app/                         Proyecto Android nativo
  native-mobile.js             Modo local, bloqueo online y guardado móvil
  native-mobile.css            Ajustes de interfaz táctil
  prepare-web.sh               Empaqueta la fuente web dentro del APK
.github/workflows/build-apk.yml Compilación y validación automática
```

## Licencias

El código original conserva su licencia PolyForm Noncommercial 1.0.0 y las atribuciones de contenido indicadas por el upstream. Este port mantiene el mismo uso no comercial.
