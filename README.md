# PSXtv 0.1.1 — prueba mínima para Kino 0.9.50

Plugin IPTV para comprobar dos listas M3U en Android TV. Cada lista aparece como una categoría bajo PSXtv en «En vivo». La guía XMLTV se incorpora después de verificar la carga, reproducción y estabilidad.

Esta versión lee las M3U dentro del plugin y devuelve canales individuales. No declara listas al lector M3U nativo: el código actual de Kino comparte ese lector entre «Mis canales» y las listas declaradas por plugins. Esta prueba permite comparar otra ruta de carga; no establece la causa del reinicio ni confirma que el fallo de Kino esté corregido.

El objetivo es Kino **0.9.50**. El manifiesto usa `apiVersion: 3`, suficiente para canales y dos ajustes URL separados; el número de API no es la versión de la app. PSXtv continúa usando la interfaz y el reproductor de Kino.

La versión 0.1.1 corrige el rechazo al instalar «El campo hosts solo puede estar vacío si el plugin tiene un ajuste de tipo url». La primera versión tenía las URL dentro de un ajuste `list`: el SDK lo acepta, pero el validador Android consultado solo cuenta los ajustes URL del nivel principal. Se usan dos ajustes URL de ese nivel para que la instalación y los permisos de red funcionen sin declarar un servidor ficticio.

## Actualizar el repositorio de esta prueba

En https://github.com/efraynns-stack/Kinoiptv abre **Add file → Upload files**. Descomprime este ZIP y sube su contenido a la raíz, reemplazando los archivos anteriores, especialmente **kino-plugin.json** y **plugin.js**. Guarda con **Commit changes** en la rama principal. Después vuelve a agregar **efraynns-stack/Kinoiptv** en Kino.

## Instalar la prueba

El ZIP contiene el código del plugin; no es una APK ni se instala directamente desde Kino.

1. Descomprime el ZIP en el computador.
2. En GitHub, crea un repositorio público nuevo, por ejemplo `psxtv-kino`, con **New repository → Public → Create repository**. Entra a **Add file → Upload files** y sube el contenido de la carpeta descomprimida. `kino-plugin.json` y `plugin.js` deben quedar directamente en la raíz, no dentro de otra carpeta. Conserva `LICENSE` y `NOTICE.md` al compartir el proyecto. Usa **Commit changes** para guardar en la rama principal.
3. En Kino 0.9.50 del TV, abre **Ajustes → Plugins → Agregar**. Escribe `efraynns-stack/Kinoiptv` para el repositorio de esta prueba, agrega e instala. Kino muestra que el plugin agrega canales y que puede reproducir los servidores indicados por tus listas.
4. Abre **Configurar** en PSXtv. Escribe la primera dirección en **URL M3U 1** y la segunda en **URL M3U 2**; los nombres iniciales son PSX y Chile. Guarda y deja **Mostrar logos** desactivado al inicio. Puedes dejar cualquiera de las dos URL vacía para probar únicamente la otra lista.

| Nombre | URL M3U |
| --- | --- |
| PSX | http://190.108.83.69:8000/playlist.m3u |
| Chile | https://m3u.cl/lista/CL.m3u |

También se puede alojar `kino-plugin.json` y `plugin.js` juntos en un servidor HTTPS público y agregar la URL del manifiesto en Kino 0.9.50. Este paquete no contiene una dirección de instalación ya publicada.

## Prueba en Android TV

Comprueba la versión exacta en la información de la app y anota el modelo del TV antes de comenzar. Prueba en la sección **PSXtv** de «En vivo», para distinguirla de las listas propias anteriores.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Configura únicamente PSX y entra a su categoría. Recorre hasta el final. | 147 canales, sin cierre ni reinicio de Kino. |
| 2 | Reproduce tres canales diferentes, al menos un minuto cada uno. | Imagen y audio; volver a la lista funciona. |
| 3 | Añade Chile, guarda y recorre ambas categorías. | 147 canales en PSX y 387 en Chile, sin reinicio. |
| 4 | Reproduce tres canales de Chile y cambia entre las dos listas. | Cada canal abre y la navegación sigue respondiendo. |
| 5 | Cierra y abre Kino tres veces. | Ambas entradas de configuración permanecen y vuelven a cargar. |
| 6 | Quita PSX de la configuración del plugin y vuelve a abrir Kino. | Chile sigue disponible; PSX deja de listar canales. |
| 7 | Vuelve a añadir PSX; después activa Mostrar logos. | Los canales conservan sus identificadores; comprueba si el fallo aparece al activar las imágenes. |

Los números corresponden a las listas consultadas el 4 de octubre de 2026; los proveedores pueden cambiar su contenido. Una línea suelta al final de la lista chilena se ignora.

Si Kino se cierra o vuelve al inicio, anota el último paso completado, qué lista abriste, si los logos estaban activados y si ocurre al guardar, listar o reproducir. Si el TV completo se reinicia, indícalo: es un resultado diferente de un cierre de Kino. Conserva el mensaje exacto o el registro del error cuando esté disponible.

## Validación realizada

- El SDK oficial acepta el manifiesto y todos los exports.
- Se ejecutaron `home`, `liveCategories`, `liveChannels` y `resolve` con las dos fuentes reales: 534 canales en seis páginas, sin descartes del contrato de salida.
- Se guardaron respuestas de las dos fuentes en `test/fixtures.json`; las nueve pruebas posteriores funcionan sin red. Se incluye una comprobación de que `hosts` vacío cuenta con ajustes URL del nivel principal.
- Las pruebas comprueban persistencia de caché, cambio de nombre y orden de listas, eliminación de una fuente, separación de identificadores, logos opcionales, cabeceras de reproducción y fallos controlados.
- Se comprobaron seis manifiestos HLS de muestra: 13 C, A G WEST, A H L1MAX, Rewind, Qultura y Retro Plus TV. Respondieron HTTP 200 y contenido HLS. Esto no verifica los segmentos, la decodificación, el audio ni todos los canales.
- La prueba en Kino/Android TV está **pendiente**. Los tests de Node no ejecutan la app Android ni demuestran que desaparezcan los reinicios.

## Límites de esta versión

Hasta dos listas, una categoría por lista y páginas de 100 canales. Hasta 1.000 canales y 512.000 caracteres por lista; las entradas adicionales quedan fuera de la prueba. La caché dura 15 minutos. Solo se guardan listas pequeñas que caben en el presupuesto de almacenamiento; las grandes se vuelven a descargar al pedir otra página.

Los logos están desactivados de forma predeterminada. Se leen nombres, URLs, `tvg-id`, `tvg-logo`, `tvg-chno` y cabeceras comunes (`#EXTVLCOPT`, `#EXTHTTP` y sufijos de URL). Se omiten entradas sin URL HTTP/HTTPS y entradas DRM. No se solicitan guías XMLTV, aunque una M3U las anuncie. La lectura está enfocada en las dos fuentes indicadas; no pretende implementar todos los formatos IPTV.

Un cambio de nombre u orden conserva los códigos de canales; cambiar la URL de una lista crea una fuente distinta. Una lista caída genera un error de esa categoría y no impide leer la otra. Kino sigue aplicando sus restricciones de red y permisos.

## Repetir la validación

Node.js 20 o superior, sin instalar dependencias npm:

```sh
node sdk/validate.mjs .
node --test test/plugin.test.mjs
```

Para volver a consultar las fuentes y actualizar las respuestas de prueba, de forma explícita:

```sh
node test/record.mjs
```

El SDK y el contrato vienen de `kinotvapp/kino-plugin-own-server`, commit `94d80528ae78509a4d3905464857218b1c2de7e6`. Las instrucciones del proyecto se consultaron en https://kinotvapp.github.io/kino-plugins/llms-full.txt, incluido AGENTS.md.
