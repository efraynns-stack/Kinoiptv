# PSXtv 0.2.0 — listas con botón Agregar

Plugin IPTV para Kino en Android TV. La configuración muestra una Lista 1 y una sección «Más listas» con el botón nativo **+ Agregar**. Cada fuente aparece como una categoría en **En vivo → PSXtv**. Hasta diez listas en total; XMLTV continúa pendiente.

Se conserva la lectura M3U dentro del plugin que ya permitió listar y reproducir PSX en el TV del usuario. Esta actualización cambia la configuración y acota la caché al usar más fuentes. Usa **apiVersion 4**, necesaria para los ajustes de tipo lista; la app observada en el TV es **Kino 0.9.49** y esta API también sirve para el objetivo inicial 0.9.50. El número de API y la versión de la app son distintos.

## Actualizar

1. Descomprime el ZIP. En https://github.com/efraynns-stack/Kinoiptv abre **Add file → Upload files** y reemplaza el contenido de la raíz, especialmente **kino-plugin.json** y **plugin.js**. Conserva LICENSE y NOTICE.md. Guarda con **Commit changes**.
2. Actualiza PSXtv desde **Ajustes → Plugins** en Kino y comprueba que muestre **0.2.0**. Usa la actualización del plugin existente para conservar su configuración.
3. Abre **Configurar PSXtv**. Los campos de la primera lista conservan las claves anteriores, por lo que el nombre PSX y la URL que ya guardaste se siguen leyendo.

La antigua pareja fija «Nombre lista 2 / URL M3U 2» se reemplaza por entradas en «Más listas». En la última foto la URL 2 estaba vacía. Si posteriormente la configuraste antes de actualizar, añade esa dirección con **+ Agregar**: el plugin no puede convertir automáticamente un ajuste que Kino deja de entregarle. Una vez añadida la misma URL, sus categorías y canales conservan los identificadores de la versión anterior.

## Agregar, editar o quitar listas

La pantalla muestra, en este orden:

- **Nombre lista 1** y **URL M3U 1**.
- **Más listas**, las entradas que agregaste y el botón **+ Agregar**.
- **Mostrar logos** y **Mostrar diagnóstico de carga**.
- **Cancelar** y **Guardar**.

Para añadir Chile:

1. Selecciona **Más listas → + Agregar** y pulsa OK.
2. Escribe **Chile** en «Nombre de la lista» y **https://m3u.cl/lista/CL.m3u** en «URL M3U».
3. Pulsa **Agregar** en el diálogo y después **Guardar** en la pantalla general de configuración.
4. Abre **En vivo → PSXtv → Chile**.

El botón abre un formulario de nombre y URL; no muestra parejas vacías de campos para todas las listas posibles. Cada entrada añadida ofrece **Editar** y **Quitar** en TV. También hay que pulsar el Guardar general después de editar o quitar. El botón se desactiva al llegar a nueve adicionales.

El nombre de una entrada adicional es opcional: si queda vacío, se usa «Lista 2», «Lista 3», etc. Su URL es obligatoria. Para dejar de usar la primera lista, vacía «URL M3U 1» y guarda: las entradas adicionales siguen funcionando. Una URL repetida se carga una sola vez. Cambiar nombres u orden conserva las referencias; cambiar la URL crea una fuente diferente.

| Fuente de prueba | URL |
| --- | --- |
| PSX | http://190.108.83.69:8000/playlist.m3u |
| Chile | https://m3u.cl/lista/CL.m3u |

Un campo vacío muestra «Sin configurar…»; esa ayuda no es una dirección guardada. Abre el campo con OK, escribe la URL y guarda tanto el diálogo como la configuración general. Kino autoriza los servidores de las URL que escribes, incluidas las añadidas en «Más listas». Se mantiene una URL en el nivel principal del manifiesto para superar el control Android de instalación con hosts vacío.

## Diagnóstico opcional

El diagnóstico queda desactivado por defecto en instalaciones nuevas; una actualización conserva el valor que ya tenías guardado. Activarlo añade una categoría **Prueba 0.2.0 | Kino … | URL 1 guardada | N listas configuradas**. Esa categoría informa y no contiene canales.

Se descargan y comprueban solo las dos primeras fuentes válidas al consultar las categorías, con un máximo de dos solicitudes simultáneas y doce segundos por solicitud. Sus títulos muestran «PSX — 147 canales», «Chile — 387 canales» o un código de fallo. Las demás se descargan cuando se abre su categoría. Esto evita descargar diez fuentes dentro de una sola llamada de veinte segundos.

| Resultado | Interpretación |
| --- | --- |
| URL 1 vacía | El campo principal no tiene una URL guardada; aún pueden existir entradas adicionales. |
| 0 listas configuradas | No se recibió ninguna URL válida. |
| error host_not_allowed | Kino rechazó un host, esquema, puerto o destino de redirección. |
| error timeout o network | La solicitud agotó el tiempo o falló la conexión. |
| error HTTP 503 u otro número | El servidor respondió con ese estado HTTP. |
| error auth_required | El servidor respondió 401 o 403. |
| error unavailable | La respuesta no era una lista IPTV con canales válidos. |
| crypto_error | Falló la generación de identificadores. |

Si falla una entrada, conserva el mensaje exacto y una foto de sus categorías. Una lista caída no impide abrir las otras. Para repetir el diagnóstico después de cambiar la configuración, guarda y vuelve a abrir la sección.

## Prueba de esta actualización en el TV

1. Verifica que PSX y su URL se mantengan después de actualizar y que siga listando los 147 canales.
2. Añade Chile con **+ Agregar**, guarda y comprueba su categoría y reproducción.
3. Cambia el nombre de Chile con **Editar** y comprueba que solo cambie el título.
4. Quita Chile, guarda y comprueba que PSX continúe funcionando.
5. Vuelve a añadir Chile, cierra y abre Kino y verifica que ambas entradas permanezcan.

Los números corresponden a las consultas del 4 de octubre de 2026 y pueden cambiar con el proveedor. El usuario confirmó carga y reproducción con 0.1.3 en Kino 0.9.49. La interfaz nueva de 0.2.0 todavía necesita esta comprobación en el TV.

## Validación y límites

El SDK oficial acepta el manifiesto y los exports. Se ejecutaron las funciones con ambas fuentes reales y se registraron sus respuestas en **test/fixtures.json**, con resultados en **test/recorded-results.json**. Las **21 pruebas sin red** verifican:

- Listar los 534 canales grabados, paginar y resolver sin descartes de contrato.
- Conservar referencias desde 0.1.3 al mantener la Lista 1 o pasar una fuente a «Más listas».
- Agregar, renombrar, mover y quitar fuentes; usar solo entradas adicionales.
- Autorizar el host y puerto de una URL adicional y rechazar otro puerto no configurado.
- Cargar diez fuentes, limitar la caché a dos textos y limitar el diagnóstico a dos descargas.
- Continuar sin caché cuando falla el almacenamiento y controlar listas caídas o malformadas.

También se comprobó el protocolo JSON con el prelude JavaScript oficial de Kino en una VM de Node: el arreglo de listas adicionales y las funciones devolvieron 147 y 387 canales. **test/bridge-results.json** registra esa comprobación. Los tests no ejecutan Kotlin, JNI, QuickJS ni la interfaz Android.

Cada lista devuelve páginas de cien canales, hasta mil canales y 512.000 caracteres por documento. La caché dura quince minutos y guarda como máximo dos textos de hasta 90.000 bytes serializados cada uno, dentro de los 256 KB permitidos por Kino. Las otras fuentes permanecen configuradas y se vuelven a descargar cuando hace falta; las que superan el tamaño de caché también se descargan de nuevo al paginar.

Los logos empiezan desactivados. Se leen nombres, URLs, tvg-id, tvg-logo, tvg-chno y cabeceras comunes de reproducción. Se ignoran entradas sin HTTP/HTTPS y entradas DRM. No se solicitan guías XMLTV. Kino mantiene sus controles de red y reproducción.

## Repetir pruebas

Node.js 20 o superior, sin dependencias npm:

```sh
node sdk/validate.mjs .
node --test test/plugin.test.mjs
```

Para consultar de nuevo las fuentes reales y actualizar las respuestas grabadas:

```sh
node test/record.mjs
```

El SDK y el contrato proceden de kinotvapp/kino-plugin-own-server, commit 94d80528ae78509a4d3905464857218b1c2de7e6. Se leyó completa https://kinotvapp.github.io/kino-plugins/llms-full.txt, incluido AGENTS.md.
