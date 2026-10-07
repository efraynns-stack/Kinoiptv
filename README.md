# PSXtv 0.2.1 — canales chilenos y listas propias

Plugin IPTV para Kino en Android TV. Incluye la lista **Chile de m3u.cl** activada por defecto:

https://m3u.cl/lista/CL.m3u

Al instalarlo, abre **En vivo → PSXtv → Chile**. No hace falta escribir la URL. También puedes cargar hasta diez listas IPTV M3U propias desde la configuración. XMLTV continúa pendiente.

## Actualizar

1. Descomprime el ZIP. En https://github.com/efraynns-stack/Kinoiptv abre **Add file → Upload files** y sube los archivos en la raíz, especialmente **kino-plugin.json** y **plugin.js**. Conserva LICENSE y NOTICE.md. Guarda con **Commit changes**.
2. En Kino abre **Ajustes → Plugins → PSXtv → Buscar actualización de PSXtv** y comprueba que muestre **0.2.1**.
3. Kino puede pedir que apruebes el nuevo dominio **m3u.cl**, necesario para la lista integrada. Acepta la actualización para habilitarla.
4. Abre **En vivo → PSXtv**. La categoría **Chile** aparece junto a las listas que ya tenías guardadas. Si no se actualiza, usa **Recargar canales**.

La actualización conserva las listas propias, sus nombres y sus referencias. Si ya tenías guardada la URL de Chile, se utiliza esa entrada con su nombre y no se duplica.

## Configuración

- **Canales chilenos:** activado por defecto; incluye la lista de m3u.cl. Desactívalo y guarda si prefieres usar solo tus fuentes.
- **Nombre lista 1 / URL M3U 1:** primera lista propia opcional. Una dirección que ya estuviera guardada se conserva.
- **Más listas → + Agregar:** escribe un nombre y una URL M3U, pulsa **Agregar** y luego **Guardar** en la pantalla general. Hasta nueve entradas adicionales. Cada una permite **Editar** y **Quitar**.
- **Mostrar logos:** desactivado por defecto; utiliza los logos publicados en cada M3U al activarlo.
- **Mostrar diagnóstico de carga:** añade una categoría de diagnóstico y comprueba las dos primeras fuentes válidas.

Los campos URL propios empiezan vacíos en una instalación nueva. Kino no permite un `default` en un ajuste de tipo `url`: Chile se integra en el código y declara su dominio en el manifiesto. Un campo «Sin configurar…» es solo una ayuda; la lista integrada funciona independientemente de ese campo.

Para dejar de cargar una lista propia, quítala de **Más listas** o vacía **URL M3U 1** y guarda. Si vacías las listas propias, Chile sigue disponible mientras **Canales chilenos** esté activado. Si tienes Chile guardada como lista propia, esa entrada sigue funcionando aunque desactives la fuente integrada.

## Cambios de 0.2.1

- Lista chilena integrada y activada por defecto, con opción para desactivarla.
- Descripción: «Canales chilenos con la lista de m3u.cl activada por defecto. También puedes cargar tus propias listas IPTV M3U desde la configuración.»
- Dominio `m3u.cl` declarado para descargar la fuente sin una URL escrita por el usuario.
- Conservación de listas existentes e identificadores; una URL repetida se carga una sola vez y se respeta el nombre guardado.

## Validación

El SDK oficial acepta el manifiesto y los exports. Las **23 pruebas** verifican el arranque sin configuración, la fuente integrada, su deduplicación con entradas existentes, la paginación, las referencias anteriores, los permisos de fuentes propias, las listas malformadas y la caché acotada incluso con diez fuentes propias más Chile.

Se descargó una copia actual de la lista chilena por HTTPS y se procesó con los valores predeterminados del manifiesto. **test/default-chile-results.json** registra el número de canales, las páginas y la aceptación del resolver sin descartes del SDK. Esta comprobación no reproduce los canales en un televisor. Las respuestas históricas de las dos fuentes de prueba continúan en **test/fixtures.json**.

Se mantiene **apiVersion 4**, necesaria para el ajuste de listas, compatible con Kino 0.9.53. No se añaden dependencias npm. Cada fuente devuelve páginas de cien canales, hasta mil canales y 512.000 caracteres por documento. La caché dura quince minutos y guarda como máximo dos textos de hasta 90.000 bytes serializados. No se descargan guías XMLTV.

Para repetir las comprobaciones:

```sh
npm test
npm run validate
```

Para renovar las respuestas históricas de las dos fuentes de prueba:

```sh
node test/record.mjs
```

El SDK y el contrato proceden de kinotvapp/kino-plugin-own-server, commit 94d80528ae78509a4d3905464857218b1c2de7e6. La guía oficial está en https://kinotvapp.github.io/kino-plugins/llms-full.txt.
