# PSXtv 0.1.3 — prueba mínima para Kino 0.9.50

Plugin IPTV para comprobar dos listas M3U en Android TV. Cada lista aparece como una categoría bajo PSXtv en «En vivo». La guía XMLTV se incorpora después de verificar la carga, reproducción y estabilidad.

Esta versión lee las M3U dentro del plugin y devuelve canales individuales. No declara listas al lector M3U nativo: el código actual de Kino comparte ese lector entre «Mis canales» y las listas declaradas por plugins. Esta prueba permite comparar otra ruta de carga; no establece la causa del reinicio ni confirma que el fallo de Kino esté corregido.

El objetivo es Kino **0.9.50**. El manifiesto usa `apiVersion: 3`, suficiente para canales y dos ajustes URL separados; el número de API no es la versión de la app. PSXtv continúa usando la interfaz y el reproductor de Kino.

La versión 0.1.3 agrega un diagnóstico visible para investigar por qué el TV sigue sin mostrar canales. «Mostrar diagnóstico de carga» empieza activado: al consultar las categorías, el plugin descarga las dos listas y muestra el número de canales obtenidos o un código de fallo en el título de cada categoría. Una categoría adicional muestra la versión del código ejecutado, la versión de Kino y si recibió cada URL. No confirma que el problema del TV esté corregido; sirve para identificar el paso que falla.

La versión 0.1.2 corrigió una confusión de la configuración en Android TV: las direcciones de ejemplo de la versión anterior aparecían debajo del campo aunque este estuviera vacío. Un campo vacío muestra ahora «Sin configurar: pulsa OK y escribe la URL». Con el diagnóstico desactivado, la falta de URL guardadas pide configurar PSXtv; con el diagnóstico activado, aparece como «URL 1 vacía / URL 2 vacía». Las direcciones se siguen escribiendo en ajustes para que Kino autorice sus servidores.

La versión 0.1.1 corrige el rechazo al instalar «El campo hosts solo puede estar vacío si el plugin tiene un ajuste de tipo url». La primera versión tenía las URL dentro de un ajuste `list`: el SDK lo acepta, pero el validador Android consultado solo cuenta los ajustes URL del nivel principal. Se usan dos ajustes URL de ese nivel para que la instalación y los permisos de red funcionen sin declarar un servidor ficticio.

## Actualizar el repositorio de esta prueba

En https://github.com/efraynns-stack/Kinoiptv abre **Add file → Upload files**. Descomprime este ZIP y sube su contenido a la raíz, reemplazando los archivos anteriores, especialmente **kino-plugin.json** y **plugin.js**. Guarda con **Commit changes** en la rama principal. Después actualiza PSXtv en Kino y comprueba que muestre la versión **0.1.3**. En los ajustes de Android del TV, abre **Apps → Kino → Forzar detención** y vuelve a iniciar Kino para comprobar la nueva versión desde un proceso nuevo.

El 4 de octubre de 2026, al iniciar esta revisión, el manifiesto público de ese repositorio todavía indicaba 0.1.1. El ZIP local no actualiza GitHub ni el plugin instalado automáticamente.

## Instalar la prueba

El ZIP contiene el código del plugin; no es una APK ni se instala directamente desde Kino.

1. Descomprime el ZIP en el computador.
2. En GitHub, crea un repositorio público nuevo, por ejemplo `psxtv-kino`, con **New repository → Public → Create repository**. Entra a **Add file → Upload files** y sube el contenido de la carpeta descomprimida. `kino-plugin.json` y `plugin.js` deben quedar directamente en la raíz, no dentro de otra carpeta. Conserva `LICENSE` y `NOTICE.md` al compartir el proyecto. Usa **Commit changes** para guardar en la rama principal.
3. En Kino 0.9.50 del TV, abre **Ajustes → Plugins → Agregar**. Escribe `efraynns-stack/Kinoiptv` para el repositorio de esta prueba, agrega e instala. Kino muestra que el plugin agrega canales y que puede reproducir los servidores indicados por tus listas.
4. Abre **Configurar** en PSXtv. Selecciona **URL M3U 1** con el control y pulsa **OK** para abrir el teclado. Escribe la primera dirección de la tabla y pulsa **Guardar** en ese diálogo. Repite con **URL M3U 2** y la segunda dirección. Pulsa también **Guardar** en la pantalla general de configuración. Deja **Mostrar logos** desactivado al inicio. Puedes dejar cualquiera de las dos URL vacía para probar únicamente la otra lista.

| Nombre | URL M3U |
| --- | --- |
| PSX | http://190.108.83.69:8000/playlist.m3u |
| Chile | https://m3u.cl/lista/CL.m3u |

En TV, una URL realmente escrita aparece como texto grande, con la etiqueta «URL M3U 1» o «URL M3U 2» más pequeña arriba, igual que el nombre de la lista. Una etiqueta grande con una línea pequeña debajo indica un campo vacío con un ejemplo. En la versión 0.1.1 esa línea pequeña era la propia dirección: verla no significaba que estuviera guardada. Para confirmar, vuelve a abrir el campo después de guardar; el texto debe estar dentro del editor.

También se puede alojar `kino-plugin.json` y `plugin.js` juntos en un servidor HTTPS público y agregar la URL del manifiesto en Kino 0.9.50. Este paquete no contiene una dirección de instalación ya publicada.

## Identificar el fallo en el TV

Deja **Mostrar diagnóstico de carga** activado. Abre **En vivo → PSXtv** y espera a que termine la carga. Debajo de Favoritos y Recientes deberían aparecer estas categorías:

- **PSX — 147 canales** y **Chile — 387 canales**, si ambos documentos se descargan y se leen correctamente. Los números pueden cambiar con el contenido de las listas.
- **Prueba 0.1.3 | Kino … | URL 1 guardada | URL 2 guardada**: prueba que se ejecutó el código nuevo y que recibió ambas direcciones. Desplázate hacia la derecha en la fila de categorías si esta etiqueta queda fuera de la pantalla.

La categoría «Prueba…» solo informa del diagnóstico y no contiene canales. Selecciona PSX o Chile para verlos. Envía una foto de los títulos de categorías y el mensaje exacto que aparezca al abrir la lista que falla.

| Resultado visible | Qué permite comprobar |
| --- | --- |
| URL 1 o URL 2 vacía | El plugin no recibió un valor guardado para ese campo. |
| URL inválida | El valor recibido no es una URL HTTP o HTTPS admitida por esta prueba. |
| PSX/Chile — error host_not_allowed | Kino rechazó el host, esquema o puerto de la solicitud, o uno de sus destinos de redirección. |
| PSX/Chile — error timeout o network | La solicitud no terminó a tiempo o falló la conexión desde el TV. |
| PSX/Chile — error HTTP 503 u otro número | El servidor respondió con ese estado HTTP. |
| PSX/Chile — error auth_required | El servidor respondió 401 o 403. |
| PSX/Chile — error unavailable | La respuesta no pudo leerse como una lista IPTV con canales válidos. |
| Prueba… — crypto_error | Falló la generación de identificadores antes de descargar las listas. |
| PSX/Chile indica canales, pero la cuadrícula queda vacía | La descarga y el análisis inicial devolvieron canales; falta examinar la llamada de canales y lo que Kino conserva o filtra. |
| No aparece ninguna categoría, ni siquiera Prueba 0.1.3 | Esta captura no prueba que el código nuevo haya llegado a ejecutarse. Hace falta verificar la versión instalada y el error o registro de Kino. |

Después de recoger el resultado, desactiva el diagnóstico para volver a los títulos PSX y Chile y a la descarga al abrir cada lista. En modo diagnóstico se hacen como máximo dos solicitudes simultáneas, cada una con un tiempo de espera de 12 segundos. Los títulos son el resultado de esa consulta de categorías, no un contador que se actualice durante la reproducción.

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
- Se ejecutaron `home`, `liveCategories`, `liveChannels` y `resolve` con las dos fuentes reales en la versión 0.1.1: 534 canales en seis páginas, sin descartes del contrato de salida. En la versión 0.1.3 se repitió la descarga real con diagnóstico activado: 147 canales de PSX y 387 de Chile, y se verificaron todas sus páginas sin descartes. El resultado y la duración están en `test/diagnostic-results.json`.
- Se guardaron respuestas de las dos fuentes en `test/fixtures.json`; las quince pruebas posteriores funcionan sin red. Se comprueban las URL del nivel principal, configuración vacía, diagnósticos de fallos y que una caché inaccesible no bloquee la descarga ni la resolución.
- También se comprobó el protocolo JSON con el prelude JavaScript oficial de Kino en una VM de Node: configuración, respuestas HTTP, hash e invocaciones serializadas devolvieron 147 y 387 canales. Se verificaron diagnósticos de configuración vacía, host rechazado y fallo de hash. `test/bridge-results.json` registra esa comprobación; no ejecuta Kotlin, JNI, QuickJS ni Android.
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
