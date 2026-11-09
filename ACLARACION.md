# Aclaración del error `Cannot read property 'indexOf' of undefined`

## Causa exacta

El error no lo causaba el backend, la URL del emulador, las coordenadas ni el archivo GLB. Lo causaba una incompatibilidad entre Three.js `GLTFLoader`, React Native/Hermes y el objeto global `navigator`.

El código problemático estaba en:

```text
mobile-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js
```

En Three.js `0.162.0`, `GLTFParser` tenía una comprobación similar a esta:

```js
if (typeof navigator !== 'undefined') {
  isSafari = /.../.test(navigator.userAgent);
  isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
}
```

En un navegador web normal, `navigator.userAgent` es una cadena como `Mozilla/5.0 ...`, por lo que `indexOf()` funciona.

En Expo Go sobre Android, el JavaScript se ejecuta dentro de React Native y Hermes. En ese entorno, `navigator` existía, pero `navigator.userAgent` era `undefined`.

Por eso Three.js terminaba ejecutando conceptualmente:

```js
undefined.indexOf('Firefox')
```

JavaScript lanzaba entonces:

```text
Cannot read property 'indexOf' of undefined
```

No era que `indexOf` estuviera roto. Se estaba llamando a `indexOf()` sobre un valor inexistente.

## Cuándo ocurría

El flujo era el siguiente:

1. La app calculaba la posición solar.
2. Android solicitaba el chunk mediante una URL como:

   ```text
   http://10.0.2.2:3000/chunk?lat=40.4168&lon=-3.7038
   ```

3. El backend respondía correctamente con HTTP `200` y el archivo GLB.
4. La app convertía la respuesta a `ArrayBuffer`.
5. Se llamaba a `GLTFLoader.parse(...)`.
6. Durante ese parseo, `GLTFParser` inspeccionaba `navigator.userAgent`.
7. Como `navigator` existía pero `navigator.userAgent` era `undefined`, fallaba `indexOf()`.
8. El `catch` de `LocationChunkViewer` mostraba:

   ```text
   No se pudo cargar la vista 3D
   Cannot read property 'indexOf' of undefined
   ```

Por eso el backend podía funcionar y aun así no aparecer ningún edificio.

## Por qué la web sí funcionaba

El navegador web proporciona automáticamente:

```js
navigator.userAgent
```

como una cadena válida. También proporciona un objeto `canvas` y un contexto WebGL con la API que Three.js espera.

Expo Go no es un navegador. Expo GL entrega un contexto WebGL nativo de React Native, y Hermes expone solo una parte del entorno web.

## Solución del error `indexOf`

En:

```text
mobile-app/src/components/location-chunk-viewer.tsx
```

se añadió una función que comprueba si `navigator.userAgent` existe y, si falta, proporciona la cadena mínima necesaria:

```ts
function ensureThreeRuntimeGlobals() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'string') {
    return;
  }

  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'React Native',
  });
}
```

La función se ejecuta antes de crear el `GLTFLoader`.

Así, Three.js recibe una cadena válida y esta operación deja de fallar:

```js
navigator.userAgent.indexOf('Firefox')
```

El valor `React Native` no pretende simular un navegador completo. Solo proporciona la propiedad que Three.js necesita para seleccionar correctamente sus rutas internas.

## El error anterior de `precision`

También existía un problema independiente al crear el renderer de Three.js. Expo GL no entrega exactamente un contexto WebGL de navegador. Three.js esperaba elementos como:

```js
gl.canvas
gl.VERSION
gl.SCISSOR_BOX
gl.VIEWPORT
gl.getShaderPrecisionFormat(...)
```

El contexto nativo de Expo GL no exponía todos esos elementos de la forma esperada. Por eso apareció anteriormente:

```text
Cannot read property 'precision' of undefined
```

Ese error ocurría porque Three.js intentaba hacer algo equivalente a:

```js
gl.getShaderPrecisionFormat(...).precision
```

cuando el resultado era `undefined`.

Para solucionarlo se creó un puente de compatibilidad que:

- Proporciona un `canvas` falso con el tamaño real del GLView.
- Proporciona los valores WebGL esperados para `VERSION`, `SCISSOR_BOX` y `VIEWPORT`.
- Protege `getParameter`.
- Protege `getShaderPrecisionFormat`.
- Devuelve una precisión segura cuando Expo GL no proporciona el objeto esperado.
- Mantiene las llamadas reales conectadas al contexto nativo de Expo.
- Utiliza un `Proxy`, porque modificar directamente el objeto nativo de Expo GL no era fiable en Hermes.

## Resultado

Se verificó el flujo real en el emulador Android:

- El backend devolvió `200` para el chunk de Madrid.
- El GLB se descargó correctamente.
- Los edificios se renderizaron.
- Desapareció `Cannot read property 'indexOf' of undefined`.
- Desapareció el mensaje `No se pudo cargar la vista 3D`.
- Los arrastres horizontal y vertical cambiaron la cámara.
- Los controles de zoom funcionaron.

La corrección del renderer y la compatibilidad de Three.js están en:

```text
ceeb795 Harden Android Three.js GL context bridge
```

La corrección del entorno GLTFLoader, los gestos y la limpieza de avisos están en:

```text
a947b48 Fix Android 3D touch navigation
```

En resumen: el error lo provocaba Three.js suponiendo que cualquier entorno con `navigator` también tenía `navigator.userAgent`. React Native/Hermes tenía `navigator`, pero no esa propiedad. Al ejecutar `navigator.userAgent.indexOf(...)`, se producía la excepción y el GLB nunca llegaba a parsearse. La solución fue proporcionar explícitamente `navigator.userAgent` y adaptar también el contexto WebGL nativo de Expo GL a la API que Three.js espera.
