# Estado del proyecto

## Proyecto

`Buscador_Sombras` contiene una aplicación móvil basada en React Native y Expo.

La aplicación está en:

```text
C:\Users\ouyan\Buscador_Sombras\mobile-app
```

Puede ejecutarse en Android, iOS y navegador web.

## Qué contiene actualmente

La idea de SombrApp es ayudar a peatones y ciclistas a elegir rutas con menos exposición solar y ayudar a conductores a encontrar aparcamiento con sombra cerca de las facultades de la UCM.

El estado actual es todavía un prototipo:

- `mobile-app/src/app/index.tsx`: calculadora de posición solar.
  - Permite introducir fecha.
  - Permite introducir hora.
  - Permite introducir latitud y longitud.
  - Calcula altura solar y acimut solar.
- `mobile-app/src/app/explore.tsx`: pantalla de ejemplo incluida por Expo.
- `mobile-app/src/app/_layout.tsx`: configuración de la navegación general.
- `mobile-app/src/components/`: componentes reutilizables, temas, pestañas y elementos animados.
- `mobile-app/assets/images/`: iconos e imágenes.
- `mobile-app/package.json`: dependencias y comandos del proyecto.
- `mobile-app/app.json`: configuración de Expo.

La navegación actual tiene dos pestañas:

```text
Home       -> calculadora solar
Explore    -> contenido de ejemplo de Expo
```

Todavía no están implementados el mapa 3D, las rutas con sombra ni la búsqueda de aparcamiento descritos en el README.

## Estado de la instalación

Node.js y npm están instalados en el equipo:

```text
Node.js: v24.21.0
npm: 11.19.0
```

Las dependencias se instalaron correctamente dentro de `mobile-app` usando:

```bash
cd C:\Users\ouyan\Buscador_Sombras\mobile-app
npm ci
```

npm mostró 30 vulnerabilidades en dependencias indirectas: 11 moderadas y 19 altas. No se ejecutó `npm audit fix --force`, ya que podría actualizar paquetes incompatibles con Expo.

También se inició Expo en modo web y respondió correctamente con HTTP 200 en:

```text
http://localhost:8081
```

Después de reiniciar, probablemente habrá que volver a iniciar el servidor.

## Cómo arrancar el proyecto después del reinicio

Abrir PowerShell, CMD o Git Bash y ejecutar:

```bash
cd C:\Users\ouyan\Buscador_Sombras\mobile-app
npm run web
```

Después abrir en el navegador la dirección que indique Expo, normalmente:

```text
http://localhost:8081
```

También se puede iniciar Expo con:

```bash
npx expo start
```

y pulsar `w` en la terminal para abrir la versión web.

## Ejecutarlo en Android con Expo Go

1. Instalar Expo Go en el móvil Android.
2. Ejecutar:

   ```bash
   cd C:\Users\ouyan\Buscador_Sombras\mobile-app
   npm start
   ```

3. Escanear el código QR mostrado por Expo.
4. El ordenador y el móvil deben estar en la misma red Wi-Fi.

Para un emulador Android configurado con Android Studio:

```bash
npm run android
```

## Comandos útiles

Ejecutar desde `mobile-app`:

```bash
npm run web       # Abrir en el navegador
npm start         # Iniciar Expo
npm run android   # Abrir en un emulador Android
npm run ios       # Abrir el simulador iOS; normalmente requiere macOS
npm run lint      # Revisar problemas de código
```

## Archivos principales para continuar

La pantalla principal se modifica en:

```text
mobile-app/src/app/index.tsx
```

La pestaña de ejemplo se modifica en:

```text
mobile-app/src/app/explore.tsx
```

Cada archivo dentro de `mobile-app/src/app/` representa una pantalla o ruta de Expo Router.

## Próximos pasos sugeridos

1. Arrancar la aplicación con `npm run web`.
2. Probar la calculadora solar.
3. Decidir si se conserva o elimina la pantalla `Explore` de ejemplo.
4. Diseñar las pantallas reales de SombrApp.
5. Implementar progresivamente mapa, rutas con sombra y búsqueda de aparcamiento.
