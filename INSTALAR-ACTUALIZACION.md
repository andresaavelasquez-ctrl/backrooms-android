# Aplicar esta actualización al repositorio

1. Extrae el contenido de este ZIP en la raíz de `backrooms-android`.
2. Conserva el archivo histórico `BackroomsNoClip-Android.zip`; esta actualización no necesita borrarlo.
3. Confirma los cambios y súbelos a GitHub:

```bash
git add .
git commit -m "feat: port Android totalmente offline"
git push origin main
```

4. En GitHub abre **Actions → Build Backrooms Offline APK → Run workflow**.
5. Descarga el artefacto **backrooms-noclip-offline-apk**.

El código del juego no se duplica en el repositorio: `mobile/prepare-web.sh` descarga durante la compilación el commit upstream fijado, lo copia dentro de los assets Android e inyecta la capa móvil. El APK resultante no declara permiso de Internet y bloquea cargas de red en WebView.
