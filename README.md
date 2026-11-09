# Chart-Lab

Herramienta web y de línea de comandos para análisis de archivos MIDI, generación automatizada de charts multi-instrumento y empaquetado de canciones para Clone Hero, YARG, Phase Shift, Moonscraper y Guitar Hero World Tour: Definitive Edition.

**Aplicación web:** [https://ey-liam.github.io/Chart-Lab/](https://ey-liam.github.io/Chart-Lab/)

---

## Propósito del Proyecto

**Chart-Lab** es un entorno interactivo desarrollado por **Ey-Liam** con un enfoque práctico y educativo. Su objetivo es facilitar a jugadores principiantes y creadores casuales la creación de sus propios charts a partir de archivos MIDI, permitiéndoles comprender la estructura interna de los archivos `.chart` y `song.ini` sin la curva de aprendizaje compleja de los editores profesionales dedicados.

---

## Qué Puedes Hacer

* **Enrutamiento y Conversión Multi-Instrumento:** Asigna pistas MIDI a Guitarra Líder, Guitarra Rítmica, Bajo, Guitarra Cooperativa, formato GHL (6 trastes), Batería (4 calles, 5 calles y Pro Drums con platillos y doble pedal), Teclados, Voz Principal, Armonías Vocales (HARM 1-3) y Pista de Baile.
* **Generación de 4 Dificultades:** Crea automáticamente las dificultades Expert, Hard, Medium y Easy aplicando reglas de reducción de acordes, filtrado de trastes y recorte de notas sostenidas (margen de 70 ms).
* **Sincronización de Letras y Secciones:** Divide letras en sílabas con soporte para modificadores vocales (`#`, `+`, `=`), genera frases (`phrase_start` / `phrase_end`) sobre la melodía MIDI y estructura secciones de práctica.
* **Reproducción MIDI + Stems y Ajuste de Onda:** Escucha las pistas MIDI mediante el sintetizador interno, reproduce pistas de audio separadas (stems) o combina ambos mientras ajustas el desfase (offset) sobre el gráfico de forma de onda.
* **Vista Previa 3D y Exportación Directa:** Previsualiza el chart en el visor 3D interactivo y descarga el paquete `.zip` con `notes.chart`, `song.ini`, audio y portada listo para la carpeta `Songs/`.

---

## Cómo Funciona (Flujo de Trabajo)

1. **Cargar MIDI:** Sube un archivo `.mid` o `.midi` en la pestaña **Pistas e Instrumentos**. El sistema detecta el mapa de tempos, compases y rango tonal de cada canal.
2. **Ajustar Instrumentos y Letras:** Selecciona el instrumento de destino para cada pista MIDI, ajusta los parámetros de densidad/acordes y, opcionalmente, sincroniza la letra en **Letras y Secciones**.
3. **Sincronizar Audio y Exportar:** Carga el audio o los stems en **Audio y Sincronización**, verifica el alineamiento en el visor de onda o en el **Visualizador 3D**, completa los datos en **Metadatos y Exportación** y descarga el archivo `.zip`.

---

## Ejecución Local y Motores Auxiliares

* **Servidor Web Local (Node.js):** Ejecuta `node server.js` y abre `http://localhost:3000`.
* **CLI en Python:** Ejecuta `python python/cli.py archivo.mid --name "Cancion" --artist "Artista" --out ./output`.
* **Motor Java:** Compila con `cd java && mvn clean package` y ejecuta `java -jar target/chart-lab-core.jar archivo.mid ./output`.
* **Componentes Unity (C# / ShaderLab):** Importa el directorio `unity_csharp/` en Unity para el renderizado de autopista curva y lectura de `.chart`.

---

## Autor y Licencia

Creado y desarrollado por **Ey-Liam**. Distribuido bajo la licencia MIT.

<br>
<sub><small>Nota: El código de este proyecto ha sido escrito desde cero por Ey-Liam. Conceptos e ideas inspirados en herramientas de la comunidad como midi-ch (EFHIII), LyricEditor (TheBoxyBear), PenguinChartEditor, Chart-Forge y documentación técnica de RBN/CSC.</small></sub>