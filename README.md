# Chart-Lab

Suite multiplataforma para análisis, generación y validación de charts para rhythm games (Clone Hero, YARG, Moonscraper y Phase Shift).

**Versión en línea lista para usar:**  
👉 **[https://ey-liam.github.io/Chart-Lab/](https://ey-liam.github.io/Chart-Lab/)**

---

## ¿Qué es y para qué sirve?

**Chart-Lab** es una herramienta diseñada para convertir archivos MIDI en canciones completamente jugables y optimizadas. Su objetivo es automatizar el proceso técnico de charting —asignación de trastes, separación de dificultades, marcación de platillos en batería, alineación de letras y validación de reglas— permitiendo a jugadores y charters obtener canciones listas para jugar o bases profesionales para ajustar sin errores de sincronización.

---

## ¿Cómo funciona? (Uso en 3 pasos)

1. **Cargar el archivo MIDI:**
   Arrastra tu archivo `.mid` o `.midi` a la plataforma. Chart-Lab analiza el tempo, compases y pistas automáticamente.
2. **Revisar asignaciones y letras:**
   * Las pistas se asignan automáticamente a sus instrumentos correspondientes (Guitarra Líder, Bajo, Batería Pro, Teclados, Voz, etc.).
   * En la pestaña **Letras**, pega el texto de la canción; el motor divide el texto en sílabas y las enlaza a la melodía vocal con marcadores de frase (`phrase_start` y `phrase_end`).
3. **Previsualizar y Exportar:**
   * Prueba el chart en tiempo real con el **Visualizador 3D** (Highway interactivo con soporte de audio y stems).
   * Pulsa **Descargar Paquete ZIP** para obtener la carpeta estructurada (`Artista - Canción [Charter]`) con `notes.chart`, `song.ini` completo y portada, lista para colocar en la carpeta `Songs/` del juego.

---

## ¿Cómo convierte las canciones?

* **Mapeo Inteligente de Trastes:**
  Analiza la dirección melódica y los saltos de octava para ubicar notas y acordes en posiciones naturales de tocar.
* **Soporte Multi-Instrumento:**
  * **Guitarra y Bajo (5 trastes):** Trastes verde a naranja, notas abiertas y acordes balanceados.
  * **Guitar Hero Live (6 trastes):** Formato GHL de 2 filas de 3 botones (White 1-3 y Black 1-3).
  * **Batería Pro & 5-Lane:** Inserción automática de platillos (Hi-Hat 64, Ride 65, Crash 66) y separación de bombo.
  * **Vocales y Armonías:** Detección de melodía principal y coros (Harm 1, 2 y 3).
  * **Pista de Baile:** Mapeo de ritmo a 4 paneles (Left, Down, Up, Right).
* **4 Dificultades con Reglas Oficiales (CSC):**
  * **Expert:** Transcripción completa con notas abiertas y acordes complejos.
  * **Hard:** Cuantización a semicorcheas, acordes simplificados y sin notas abiertas.
  * **Medium:** Cuantización a corcheas, máximo 2 notas por acorde y **sin nota naranja**.
  * **Easy:** Cuantización a negras, notas individuales y **sin notas azul ni naranja**.
* **Regla de 70 ms en Sustains:**
  Aplica un margen de 70 ms antes de la siguiente nota para permitir reposicionar la mano sin perder puntuación.
* **Validador Cero-Defectos:**
  Audita el orden temporal (monotonicidad) y elimina colisiones de notas antes de la exportación para garantizar compatibilidad con EnChor y YARG.

---

## Opciones de Ejecución

### 1. Web Online (Recomendado)
Accede directamente desde cualquier navegador moderno en cualquier sistema operativo:  
👉 **[https://ey-liam.github.io/Chart-Lab/](https://ey-liam.github.io/Chart-Lab/)**

### 2. Servidor Local (Node.js)
```bash
# Windows (doble clic o terminal)
start.bat

# Manual
node server.js
```
Abre `http://localhost:3000` en el navegador.

### 3. Línea de Comandos (Python CLI)
```bash
python python/cli.py <ruta-al-midi> --name "Nombre" --artist "Artista" --out ./output
```

### 4. Motor Java / Unity C#
* **Java:** `cd java && mvn clean package` para ejecutar el conversor por lotes multiplataforma.
* **Unity:** Importa la carpeta `unity_csharp/` para controladores de gameplay y shaders de carretera curva en Unity.

---

## Licencia

Distribuido bajo la Licencia MIT. Consulta `LICENSE` para más información.

<br>
<sub>Inspiration: Conceptual idea inspired by EFHIII.</sub>
