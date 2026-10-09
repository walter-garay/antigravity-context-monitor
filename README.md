# Antigravity Context Window Monitor 🚀

[![Antigravity Version](https://img.shields.io/badge/Antigravity-2.0%2B-blue.svg)](https://antigravity.google)
[![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg)](https://github.com/walter-garay/antigravity-context-monitor/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#instalación-rápida)

> **Monitor en tiempo real del uso de la ventana de contexto, tokens y saturación de chat para la aplicación de escritorio de Google Antigravity (Antigravity 2.0).**

---

## 🔍 ¿Por qué necesitas este plugin?

Cuando trabajas con agentes autónomos en **Google Antigravity Desktop**, el consumo de tokens no ocurre únicamente por los mensajes de texto, sino por:
1. **Lectura masiva de archivos** (`view_file`, análisis de repositorios).
2. **Salidas de comandos de terminal** y compilaciones de código.
3. **Búsquedas web y llamadas a herramientas MCP**.

A medida que el chat se satura, ocurren dos problemas críticos:
* **Efecto *"Lost in the Middle"*:** El modelo empieza a ignorar o distorsionar instrucciones y reglas fijadas al inicio.
* **Compactación automática (*Context Compaction*):** Antigravity comprime el historial antiguo para no desbordar la ventana, perdiendo detalles clave de turnos pasados.

**Antigravity Context Window Monitor** se integra directamente en el **panel auxiliar (Auxiliary Pane)** de tu chat para mostrarte en vivo exactamente cuántos tokens llevas consumidos, cuánto espacio resta y cuándo es el momento óptimo para abrir un nuevo chat.

---

## ✨ Características Principales

* 📊 **Métricas de tokens en vivo:** Conteo exacto de tokens de entrada (`input_tokens`), tokens en caché (`cache_read_tokens`) y tokens generados (`output_tokens`).
* 🎯 **Detección automática de modelo:** Detecta si tu conversación usa **Gemini Flash (1.048.576 tokens)** o **Gemini Pro (2.097.152 tokens)** y adapta la barra en consecuencia.
* 🚦 **Semáforo de salud de contexto:**
  * 🟢 **Óptimo (< 25%):** Respuestas rápidas, máxima atención del agente.
  * 🟡 **Moderado (25% - 55%):** Rango de trabajo estándar.
  * 🟠 **Pesado (55% - 80%):** Recomendación de cerrar el hito de la tarea.
  * 🔴 **Sobrecargado (> 80%):** Riesgo alto de pérdida de contexto (*Lost in the Middle*).
  * 🟣 **Compactado:** Alerta visual inmediata si Antigravity ya comprimió turnos pasados.
* 🛠️ **Registro de actividad reciente:** Seguimiento de los últimos pasos ejecutados (herramientas invocadas, archivos inspeccionados y respuestas).
* 📋 **Acciones rápidas:** Copia un resumen diagnóstico al portapapeles o inicia un nuevo chat limpio en 1 clic.
* 🔄 **Actualizador integrado (1-Click Update):** Detecta nuevas versiones en GitHub y te permite actualizar el plugin directamente desde el panel sin salir de Antigravity.

---

## ⚡ Instalación Rápida (1 Comando)

### En Windows (PowerShell)
Abre PowerShell y ejecuta:

```powershell
irm https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main/install.ps1 | iex
```

### En macOS y Linux (Bash)
Abre tu terminal y ejecuta:

```bash
curl -fsSL https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main/install.sh | bash
```

---

## 🚀 Cómo abrirlo en Antigravity Desktop

Una vez instalado:

1. Abre **Antigravity Desktop** y entra a cualquier conversación.
2. En la esquina superior derecha del chat, haz clic en el menú de opciones (**⋮**).
3. Selecciona **Extensions** ➔ **Context Monitor**.
4. ¡Listo! El monitor se abrirá en la barra lateral derecha junto a tu chat y comenzará a medir el contexto en tiempo real.

> 💡 **Tip:** También puedes abrirlo haciendo clic en este enlace dentro de cualquier respuesta de Antigravity:  
> `[Abrir Context Monitor](sidecar://context-monitor/panel/)`

---

## 🔄 Cómo Mantenerlo Actualizado

Mantener **Antigravity Context Window Monitor** al día es sumamente sencillo:

* **Opción A (Desde el propio panel):** En la parte inferior del panel del monitor, haz clic en **"Buscar actualización"**. Si hay una versión nueva, pulsa el botón **"Actualizar ahora"**.
* **Opción B (Re-ejecutar el instalador):** Vuelve a ejecutar el comando de instalación de 1 línea en cualquier momento; descargará la versión más reciente automáticamente sin borrar tus configuraciones.

---

## 📂 Estructura del Proyecto

```text
antigravity-context-monitor/
├── plugin.json                 # Manifiesto del plugin de Antigravity
├── install.ps1                 # Instalador y actualizador para Windows
├── install.sh                  # Instalador y actualizador para macOS/Linux
├── assets/
│   └── logo.svg                # Logo del plugin
└── sidecars/
    └── panel/
        ├── sidecar.json        # Manifiesto del sidecar (Node.js + Web UI)
        ├── package.json        # Configuración del paquete ES module
        ├── main.mjs            # Backend: lectura de logs locales y APIs
        ├── index.html          # Interfaz visual del panel
        ├── app.js              # Lógica reactiva y conexión con Sidecar SDK
        └── styles.css          # Estilos adaptados al tema de Antigravity
```

---

## 🛡️ Privacidad y Seguridad

* **100% Local:** La extensión se ejecuta como un Sidecar local en tu máquina.
* **Sin telemetría externa:** Solo lee los archivos de transcripción locales generados por tu propio cliente de Antigravity en `%USERPROFILE%\.gemini\antigravity\brain\`. Ningún dato de tu código se envía a servidores de terceros.

---

## 🤝 Contribuciones

¡Las contribuciones, reportes de problemas y sugerencias son bienvenidas!
1. Haz un Fork de este repositorio.
2. Crea una rama para tu mejora (`git checkout -b feature/nueva-mejora`).
3. Haz commit de tus cambios (`git commit -m 'Agregar nueva mejora'`).
4. Haz push a tu rama (`git push origin feature/nueva-mejora`).
5. Abre un Pull Request.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).

---

Desarrollado con ❤️ por **[Walter Garay](https://github.com/walter-garay)** para la comunidad de desarrolladores de Google Antigravity.
