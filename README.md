# 🎸 Chart-Lab

<div align="center">

![Chart-Lab Banner](https://img.shields.io/badge/CHART--LAB-Studio%20v1.0-38bdf8?style=for-the-badge&logo=musicalnotes&logoColor=white)
![Clone Hero & YARG Compatible](https://img.shields.io/badge/Clone%20Hero%20%7C%20YARG-100%25%20Compatible-00e676?style=for-the-badge)
![Zero-Error Chart Guarantee](https://img.shields.io/badge/Mathematical-Zero--Error%20Linter-ffea00?style=for-the-badge)
![Multi-Language](https://img.shields.io/badge/Stack-Web%20%7C%20C%23%20%7C%20ShaderLab%20%7C%20Python%20%7C%20Java-d500f9?style=for-the-badge)

<p align="center">
  <b>Suite profesional de conversión, auto-charter, sincronización y simulación de ritmo para Clone Hero, YARG, Moonscraper y Phase Shift.</b><br>
  <i>Reimaginación desde cero del concepto pionero de <a href="https://github.com/EFHIII/midi-ch">EFHIII / midi-ch</a> e inspirada en la simulación interactiva de <a href="https://github.com/uwuHero/uwuHero.github.io">uwuHero</a>.</i>
</p>

</div>

---

## 📑 Tabla de Contenidos

- [¿Por qué Chart-Lab?](#-por-qué-chart-lab)
- [Comparativa con Herramientas Anteriores](#-comparativa-con-herramientas-anteriores)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Ecosistemas y Componentes](#-ecosistemas-y-componentes)
  - [1. Web Studio (HTML5, CSS3, JS)](#1-web-studio-html5-css3-javascript)
  - [2. Unity, C# & ShaderLab](#2-unity-c--shaderlab-shaders)
  - [3. Python Toolkit & CLI](#3-python-toolkit--cli)
  - [4. Java Core Engine](#4-java-core-engine)
- [Garantía "Zero-Error Chart"](#-garantía-zero-error-chart)
- [Instalación y Uso](#-instalación-y-uso)
- [Créditos y Licencia](#-créditos-y-licencia)

---

## 💡 ¿Por qué Chart-Lab?

En la comunidad de rhythm games, convertir canciones MIDI en charts jugables siempre ha sido una tarea fragmentada:
- **midi-ch (EFHIII):** Fue el gran pionero, pero requería usar páginas aisladas (`/` para guitarra, `/drums` para percusión, `/lyrics` con MusicXML) y carecía de metadatos completos (`song.ini`) o gestión de audio.
- **uwuHero:** Demostró lo divertido de jugar directamente en el navegador con soundfonts y puntuación, pero sin soporte para generación de paquetes completos de juego.

**Chart-Lab** rediseña todo el proceso desde sus fundamentos matemáticos:
1. **Unificación Multi-Instrumento:** Procesa en un único archivo MIDI la **Guitarra Líder**, **Bajo**, **Guitarra Rítmica**, **Teclados/Piano**, **Batería (Pro Drums)** y **Voz/Letras**.
2. **Generación Automática de las 4 Dificultades:** `Expert`, `Hard`, `Medium` y `Easy` para todos los instrumentos con decimación rítmica y control de acordes.
3. **Alineador Fonético de Letras:** Si el MIDI no trae letras incrustadas, pegas el texto lírico y el motor divide las sílabas automáticamente y las ancla a las notas vocales en el formato exacto de Clone Hero (`phrase_start`, `lyric `, `phrase_end`).
4. **Sincronización de Audio & Stems:** Ajuste milimétrico de desfase (**Audio Offset** en ms) para pistas completas o stems separados (`guitar.ogg`, `bass.ogg`, `drums.ogg`, etc.).
5. **Carretera 3D Interactiva & Simulador:** Canvas con perspectiva cónica a 60 FPS, shaders ShaderLab HLSL para Unity y sintetizador polifónico en tiempo real.
6. **Paquete ZIP de 1 Clic:** Exporta `notes.chart`, `song.ini`, portada (`album.png`) y audios listos para arrastrar a tu carpeta de canciones.

---

## 📊 Comparativa con Herramientas Anteriores

| Característica | midi-ch (EFHIII) | uwuHero | **Chart-Lab** |
| :--- | :---: | :---: | :---: |
| **Instrumentos Simultáneos** | ❌ (Solo 1 por página) | ❌ (Solo 1 por track) | **✅ Guitarra, Bajo, Batería, Teclas, Rítmica, Voz** |
| **Dificultades Automáticas** | ⚠️ (Solo en `/auto`) | ❌ | **✅ Expert, Hard, Medium, Easy simultáneos** |
| **Motor de Batería (GM Drums)** | ⚠️ (Página aparte) | ❌ | **✅ 4-Lane + Platillos Pro (Yellow, Blue, Green)** |
| **Alineador de Letras desde Texto** | ❌ (Solo MusicXML) | ❌ | **✅ Fonético automático a notas vocales** |
| **Gestión de Stems & Audio Offset** | ❌ | ❌ | **✅ Offset en ms + Mute/Solo por stem** |
| **Auditor de Errores de Chart** | ❌ | ❌ | **✅ ChartValidator matemático integrado** |
| **Visualizador / Simulador** | ⚠️ (2D plano) | ✅ (Web player) | **✅ Canvas 3D a 60 FPS + Shaders Unity** |
| **Descarga Lista para el Juego** | ⚠️ (Solo `.chart`) | ❌ | **✅ Paquete ZIP (`.chart` + `song.ini` + audio)** |

---

## 🏛️ Arquitectura del Proyecto

```text
Chart-Lab/
├── .github/
│   ├── workflows/verify-charts.yml    # CI/CD automatizado para validar charts
│   └── ISSUE_TEMPLATE/                # Plantillas para bugs y peticiones
├── web/                               # Web Studio interactivo (SPA)
│   ├── index.html                     # Interfaz de usuario Cyberpunk
│   ├── styles.css                     # Estilos dark neón
│   ├── js/
│   │   ├── core/                      # Parsers y motores matemáticos
│   │   │   ├── midi-parser.js         # Lector binario de MIDI
│   │   │   ├── charter-engine.js      # Asignación a frets y acordes
│   │   │   ├── lyrics-aligner.js      # Silabificador fonético
│   │   │   └── chart-validator.js     # Linter matemático de colisiones
│   │   ├── audio/audio-manager.js     # Web Audio API & Stems
│   │   ├── visualizer/highway-3d.js   # Highway 3D a 60 FPS
│   │   ├── export/package-exporter.js # Generador de .chart, song.ini y ZIP
│   │   └── app.js                     # Controlador principal
│   └── vendor/jszip.min.js            # Empaquetado cliente offline
├── unity_csharp/                      # Integración con Unity / Desktop
│   ├── Scripts/
│   │   ├── ChartLabModel.cs           # Modelos de datos de notas y canciones
│   │   ├── ChartParser.cs             # Lector de charts y cálculo temporal
│   │   ├── HighwayController.cs       # Controlador de carretera y puntuación (uwuHero)
│   │   └── ChartValidator.cs          # Linter en C# contra colisiones
│   └── Shaders/
│       ├── RhythmHighway.shader       # ShaderLab HLSL carretera curva y compases
│       └── NoteGemGlow.shader         # ShaderLab gemas 3D con Star Power
├── python/                            # Kit de herramientas por consola
│   ├── chart_lab/
│   │   ├── midi_processor.py          # Lector binario nativo de MIDI
│   │   ├── charter.py                 # Algoritmo de mapeo a instrumentos
│   │   ├── lyrics_sync.py             # Sincronizador de letras
│   │   └── validator.py               # Auditor y reparador de charts
│   ├── cli.py                         # CLI ejecutable
│   └── requirements.txt
├── java/                              # Motor multiplataforma Java
│   ├── src/main/java/com/chartlab/
│   │   ├── model/                     # ChartSong, ChartNote
│   │   ├── parser/MidiReader.java     # javax.sound.midi parser
│   │   ├── engine/ChartBuilder.java   # Generador de notas
│   │   └── Main.java                  # CLI en Java
│   └── pom.xml                        # Configuración Maven
├── demo/                              # Canción de demostración incluida
│   ├── Olivia_Rodrigo_-_teenage_dream.mid
│   └── lyrics_sample.txt
├── server.js                          # Servidor HTTP local sin dependencias
├── start.bat                          # Lanzador de 1 clic para Windows
└── README.md
```

---

## 🛡️ Garantía "Zero-Error Chart"

Uno de los problemas más comunes en charters generados automáticamente son los errores de colisión y tiempo. **Chart-Lab** incluye el motor **`ChartValidator`** (implementado en JS, Python y C#) que ejecuta auditorías matemáticas automáticas:

1. **Monotonía Temporal Estricta ($T_i \ge T_{i-1}$):** Previene que notas fuera de orden corrompan el motor de Clone Hero.
2. **Protección Contra Colisión de Sustains:** Si una nota sostenida sobrepasa a la siguiente nota en el mismo traste, el sustain se recorta automáticamente respetando un margen de seguridad ($Gap = PPQ / 8$).
3. **Verificación de Límites de Trastes:** Garantiza trastes válidos [0..4], notas abiertas [7] y platillos [64..66].
4. **Validación de SyncTrack:** Sincroniza tiempos de compás y BPMs en microsegundos exactos.

---

## 🚀 Instalación y Uso

### 1. Web Studio (Recomendado)
Haz doble clic en **`start.bat`** (o ejecuta `node server.js`). Tu navegador se abrirá automáticamente en:
`http://localhost:3000`

- Arrastra tu archivo `.mid`.
- Usa *"✨ Auto-Asignar Inteligente"* o ajusta los instrumentos manualmente.
- Pega la letra y pulsa *"Sincronizar Sílabas"*.
- Carga tu audio y ajusta el **Audio Offset**.
- Prueba la canción con <kbd>Barra Espaciadora</kbd> en la Highway 3D.
- Pulsa **"📦 Descargar Paquete Completo (.ZIP)"**.

### 2. Python CLI
```bash
python python/cli.py demo/Olivia_Rodrigo_-_teenage_dream.mid \
  --name "teenage dream" \
  --artist "Olivia Rodrigo" \
  --album "GUTS" \
  --year "2023" \
  --lyrics demo/lyrics_sample.txt \
  --out ./output
```

### 3. Java Core CLI
```bash
cd java
mvn clean package
java -jar target/chart-lab-core-1.0.0.jar ../demo/Olivia_Rodrigo_-_teenage_dream.mid ../output
```

### 4. Unity / C#
Copia la carpeta `unity_csharp/` a tu proyecto de Unity. Arrastra `HighwayController` a un GameObject en tu escena y asigna los materiales con `RhythmHighway.shader` y `NoteGemGlow.shader`.

---

## 🎮 Cómo Jugar tu Canción en Clone Hero o YARG

1. Descomprime el archivo `.zip` descargado.
2. Copia la carpeta resultante en:
   - **Clone Hero:** `Documentos/Clone Hero/Songs/`
   - **YARG:** `Documentos/YARG/Songs/`
3. Inicia el juego y entra en **Settings > Scan Songs**.
4. ¡Disfruta tocando con Guitarra, Bajo, Batería o Teclados!

---

## 🙏 Créditos y Agradecimientos

- **Concepto Original:** [Saffron Haas (@EFHIII)](https://github.com/EFHIII/midi-ch) por la lógica inicial de conversión MIDI a Clone Hero.
- **Inspiración de Simulación:** Comunidad de [uwuHero](https://github.com/uwuHero/uwuHero.github.io).
- **Diseño & Desarrollo:** Antigravity AI & Liam.
