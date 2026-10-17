# Karakeep

Conecte Gladys con [Karakeep](https://karakeep.app) (antes Hoarder), la
aplicación autoalojada de marcadores, notas e imágenes: siga sus contadores,
reaccione cuando se añade un marcador o se marca como favorito, y guarde enlaces
o notas desde sus escenas o desde el panel. Todo se queda en su red local:
Gladys habla directamente con su servidor Karakeep.

Probada con un servidor Karakeep 0.33.2 real (la imagen Docker oficial). Sus
comentarios son bienvenidos en el foro de Gladys.

## Requisitos previos

- Gladys Assistant 5.2 o posterior.
- Un servidor Karakeep accesible desde la máquina de Gladys, en el puerto 3000
  por defecto, o detrás de un proxy inverso.
- Una clave de API: en Karakeep, abra **Ajustes → Claves API** y cree una. La
  integración ve los marcadores del usuario al que pertenece la clave.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. En **Dirección de Karakeep**, introduzca la dirección IP del servidor, por
   ejemplo `192.168.1.50`: la integración usa entonces el puerto 3000. Añada el
   puerto si es otro (`192.168.1.50:3100`). Detrás de un proxy inverso,
   introduzca la dirección completa (`https://keep.example.org`).
3. Pegue la **Clave de API**.
4. **Leer Karakeep cada**: 1, 5 (por defecto), 15, 30 o 60 minutos. Los nuevos
   marcadores y favoritos se anuncian en la siguiente lectura.
5. **Idioma de nombres y mensajes** fija los nombres de las funciones (fijados
   al añadir el dispositivo) y los textos de la integración. Francés por
   defecto.
6. Guarde y use **Probar la conexión**: muestra el usuario de Karakeep y el
   número de marcadores y listas.
7. En la pestaña **Descubrir**, añada el dispositivo **Karakeep**.

## Dispositivo

**Karakeep** (un dispositivo para el usuario de la clave de API):

| Función         | Valor                                             |
| --------------- | ------------------------------------------------- |
| Marcadores      | número de marcadores (enlaces, notas y archivos)  |
| No archivados   | marcadores aún no archivados: su lista de lectura |
| Favoritos       | marcadores marcados como favoritos                |
| Archivados      | marcadores archivados                             |
| Listas          | número de listas                                  |
| Etiquetas       | número de etiquetas                               |
| Destacados      | número de destacados                              |
| Último marcador | título del marcador más reciente, o «Ninguno»     |

Los contadores conservan su historial: un gráfico muestra cómo crece su lista
de lectura.

## Widget del panel

**Karakeep**: tres mosaicos (marcadores, no archivados, favoritos), los seis
marcadores más recientes y un botón **Guardar**. En los ajustes del widget,
**Marcadores mostrados** elige los más recientes, los últimos favoritos o los
últimos no archivados. Toque un marcador para leer su descripción o su nota y
abrir el enlace (solo enlaces https; **Abrir en Karakeep** aparece cuando se
accede a Karakeep por https). **Guardar** abre un formulario: escriba un enlace
(`https://…` o `www.…`) o el texto de una nota, marque **Favorito** si lo desea,
y la integración lo guarda.

## Disparadores de escena

- **Nuevo marcador**: se guarda un enlace, una nota o un archivo en Karakeep,
  desde la aplicación web, la extensión del navegador, la aplicación móvil o un
  feed RSS. El filtro **Tipo** conserva solo los enlaces, las notas o los
  archivos. Las importaciones y los marcadores guardados por esta integración no
  se anuncian.
- **Marcador marcado como favorito**: un marcador se marca como favorito en
  Karakeep.

Variables de ambos: **Título**, **Enlace** (vacío para una nota), **Texto de la
nota** (vacío para un enlace), **Tipo** (`link`, `text` o `asset`), **Tipo, en
palabras** y **Etiquetas** (separadas por comas).

La primera lectura tras la instalación es silenciosa: los marcadores ya
presentes no se anuncian. Se disparan como máximo diez eventos por lectura; el
resto se cuenta como visto.

## Acciones de escena

- **Guardar un enlace en Karakeep**: **Enlace** (obligatorio) y, si lo desea,
  **Título**, **Lista** (el nombre de una lista existente, sin importar
  mayúsculas o minúsculas), **Etiquetas** (separadas por comas; las que faltan
  se crean) y **Marcar como favorito**. Devuelve **Id. del marcador**,
  **Título** y **Ya guardado** (el enlace ya estaba en Karakeep: Karakeep
  conserva un solo marcador por enlace).
- **Guardar una nota en Karakeep**: lo mismo, con el **Texto de la nota** en
  lugar del enlace. Devuelve **Id. del marcador** y **Título**.

Una lista inteligente no puede recibir marcadores: Karakeep la llena según su
consulta.

## Ejemplos de escenas

- **Botón de la compra**: se pulsa un botón Zigbee de la cocina → **Guardar una
  nota en Karakeep** con el texto `Comprar café`, lista `Compra`, etiqueta
  `casa`.
- **Recordatorio de lectura**: cada viernes a las 18:00 → continuar solo si la
  función **No archivados** supera 20 → enviar un mensaje «Su lista de lectura
  de Karakeep tiene más de 20 marcadores».
- **Notas en el móvil**: disparador **Nuevo marcador**, tipo **Nota** → enviar
  un mensaje «Nota: {{triggerEvent.data.text}}».
- **Favorito para compartir**: disparador **Marcador marcado como favorito** →
  enviar un mensaje «Nuevo favorito: {{triggerEvent.data.title}}
  {{triggerEvent.data.url}}».

## Solución de problemas

- **«Karakeep rechazó la clave de API»**: la clave se eliminó o se copió mal.
  Cree una nueva en Karakeep → Ajustes → Claves API.
- **«Karakeep no responde»**: compruebe la dirección y el puerto desde la
  máquina de Gladys. El contenedor usa una red en puente: `localhost` es el
  propio contenedor, introduzca en su lugar la dirección IP del servidor.
- **«Esta dirección no responde como Karakeep»**: responde una página de inicio
  de sesión de un proxy en lugar de Karakeep. Introduzca la dirección del propio
  Karakeep, o deje pasar la máquina de Gladys por el proxy.
- **«No hay ninguna lista … en Karakeep»**: el nombre de lista de la acción de
  escena debe coincidir con una lista existente. Créela primero en Karakeep.
- Para ver más detalles en los registros de la integración, defina
  `LOG_LEVEL=debug`.

## Límites

- Un solo usuario de Karakeep: el propietario de la clave de API.
- Los disparadores se activan en la siguiente lectura (5 minutos por defecto),
  no al instante: Karakeep no envía nada por sí mismo.
- Marcar y desmarcar un favorito entre dos lecturas pasa desapercibido.
- La integración nunca elimina ni archiva nada en Karakeep.
- Sin relación con el proyecto Karakeep.
