import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, '..', '..');
const APP_DATA_DIR = process.env.ANTIGRAVITY_APP_DATA_DIR || join(homedir(), '.gemini', 'antigravity');
const BRAIN_DIR = join(APP_DATA_DIR, 'brain');

const CURRENT_VERSION = '1.0.2';
const GITHUB_REPO = 'walter-garay/antigravity-context-monitor';
const RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

const app = new SidecarApp();

// Serve frontend assets
const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

app.page('/', () => readLocal('index.html'));
app.page('/app.js', () => readLocal('app.js'));
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css' }), 'GET');

// Status endpoint
app.api('/api/status', () => ({
  version: CURRENT_VERSION,
  node: process.version,
  platform: `${platform()} ${release()}`,
  appDataDir: APP_DATA_DIR,
  brainDirExists: existsSync(BRAIN_DIR),
}), 'GET');

// Generate Handover Summary for transferring context to a new chat
function generateHandoverSummary(conversationId) {
  if (!conversationId) {
    return {
      summary: 'No hay conversación activa seleccionada.',
      hasData: false,
    };
  }

  const convoDir = join(BRAIN_DIR, conversationId);
  const transcriptPath = join(convoDir, '.system_generated', 'logs', 'transcript.jsonl');

  if (!existsSync(transcriptPath)) {
    return {
      summary: 'Conversación nueva sin historial registrado aún.',
      hasData: false,
    };
  }

  try {
    const rawContent = readFileSync(transcriptPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    const userRequests = [];
    const filesTouched = new Set();

    for (const line of lines) {
      try {
        const step = JSON.parse(line);
        if (step.type === 'USER_INPUT' && step.content) {
          const match = step.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
          const req = (match ? match[1] : step.content).trim();
          if (req.length > 3) userRequests.push(req);
        }
        if (step.tool_calls && Array.isArray(step.tool_calls)) {
          for (const tc of step.tool_calls) {
            if (tc.args) {
              let f = tc.args.TargetFile || tc.args.targetFile || tc.args.AbsolutePath || tc.args.path;
              if (f && typeof f === 'string' && (tc.name.includes('file') || tc.name.includes('write'))) {
                f = f.replace(/\\/g, '/').replace(/^"|"$/g, '');
                if (!f.includes('.system_generated') && !f.endsWith('.log') && !f.includes('/builtin/')) {
                  const filename = f.split('/').pop();
                  if (filename && !filename.includes('transcript')) {
                    filesTouched.add(filename);
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    const initialGoal = userRequests[0] || 'Desarrollo del proyecto';
    const latestGoal = userRequests[userRequests.length - 1] || 'Continuación de desarrollo';
    const fileList = Array.from(filesTouched);

    const historyItems = userRequests.slice(1, -1);
    const historyText = historyItems.length > 0
      ? historyItems.map((r, i) => `${i + 1}. ${r.length > 120 ? r.slice(0, 120) + '...' : r}`).join('\n')
      : '- Sin pasos intermedios relevantes.';

    const summaryMarkdown = `### 📋 RESUMEN DE CONTINUIDAD (TRANSFERENCIA DE CONTEXTO)

**Objetivo Inicial:**
${initialGoal}

**Historial de Cambios / Requerimientos Realizados:**
${historyText}

**Archivos Principales Modificados:**
${fileList.length > 0 ? fileList.map(f => `- \`${f}\``).join('\n') : '- Archivos del repositorio local.'}

**Estado Actual y Tarea Pendiente:**
${latestGoal}

---
**Instrucción para el nuevo chat:**
Continuamos el trabajo desde este punto con el contexto limpio. Por favor toma este resumen como base y continúa con el estado actual sin repetir lo ya implementado.`;

    return {
      summary: summaryMarkdown,
      initialGoal,
      latestGoal,
      filesTouched: fileList,
      hasData: true,
    };
  } catch (err) {
    return {
      summary: `Error al generar resumen: ${err.message}`,
      hasData: false,
    };
  }
}

// Context analysis handler
function analyzeConversationContext(conversationId) {
  if (!conversationId) {
    return {
      error: 'No conversation ID provided',
      hasData: false,
      version: CURRENT_VERSION,
    };
  }

  const convoDir = join(BRAIN_DIR, conversationId);
  const transcriptPath = join(convoDir, '.system_generated', 'logs', 'transcript.jsonl');

  if (!existsSync(transcriptPath)) {
    return {
      conversationId,
      hasData: false,
      version: CURRENT_VERSION,
      message: 'Conversación nueva o sin turnos registrados todavía.',
      currentTokens: 0,
      maxTokens: 1048576,
      percentUsed: 0,
      statusLevel: 'optimal',
      statusMessage: 'Chat nuevo. Contexto completamente disponible.',
      recommendation: 'Puedes interactuar con total normalidad.',
    };
  }

  try {
    const rawContent = readFileSync(transcriptPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    let totalSteps = lines.length;
    let userPromptCount = 0;
    let modelTurnCount = 0;
    let toolCallCount = 0;
    let detectedModel = 'Gemini 3.8 Flash';
    let maxTokens = 1048576; // 1M tokens por defecto para Flash

    let lastModelStep = null;
    let cumulativeOutputTokens = 0;
    let previousContextTokens = 0;
    let compactionDetected = false;
    let compactionTurn = null;

    const recentEvents = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const step = JSON.parse(lines[i]);

        // Model detection
        if (step.content && typeof step.content === 'string') {
          if (step.content.includes('Gemini 3.8 Pro') || step.content.includes('Gemini Pro') || step.content.includes('Pro')) {
            detectedModel = 'Gemini Pro';
            maxTokens = 2097152;
          } else if (step.content.includes('Gemini 3.8 Flash') || step.content.includes('Gemini Flash') || step.content.includes('Flash')) {
            detectedModel = 'Gemini 3.8 Flash';
            maxTokens = 1048576;
          }
        }

        if (step.type === 'USER_INPUT') {
          userPromptCount++;
          recentEvents.push({
            stepIndex: step.step_index ?? i,
            type: 'user',
            label: 'Mensaje de usuario',
            detail: (step.content || '').slice(0, 80).replace(/\n/g, ' '),
            time: step.created_at,
          });
        } else if (step.type === 'PLANNER_RESPONSE') {
          modelTurnCount++;
          const inTokens = step.input_tokens || 0;
          const cacheTokens = step.cache_read_tokens || 0;
          const outTokens = step.output_tokens || 0;
          const currentTotal = inTokens + cacheTokens;

          cumulativeOutputTokens += outTokens;

          // Check if context dropped abruptly (compaction)
          if (previousContextTokens > 10000 && currentTotal < previousContextTokens * 0.75) {
            compactionDetected = true;
            compactionTurn = step.step_index ?? i;
          }
          previousContextTokens = currentTotal;
          lastModelStep = step;

          if (step.tool_calls && Array.isArray(step.tool_calls)) {
            toolCallCount += step.tool_calls.length;
            for (const tc of step.tool_calls) {
              recentEvents.push({
                stepIndex: step.step_index ?? i,
                type: 'tool',
                label: `Herramienta: ${tc.name || 'desconocida'}`,
                detail: tc.args ? Object.keys(tc.args).join(', ') : '',
                time: step.created_at,
              });
            }
          } else {
            recentEvents.push({
              stepIndex: step.step_index ?? i,
              type: 'model',
              label: 'Respuesta del modelo',
              detail: `${outTokens} tokens emitidos`,
              time: step.created_at,
            });
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    const currentInputTokens = lastModelStep ? (lastModelStep.input_tokens || 0) : 0;
    const currentCacheTokens = lastModelStep ? (lastModelStep.cache_read_tokens || 0) : 0;
    const currentOutputTokens = lastModelStep ? (lastModelStep.output_tokens || 0) : 0;
    const currentTokens = currentInputTokens + currentCacheTokens;

    const percentUsed = maxTokens > 0 ? ((currentTokens / maxTokens) * 100) : 0;

    let statusLevel = 'optimal';
    let statusMessage = 'Óptimo: Contexto despejado. Respuestas rápidas y alta retención de instrucciones.';
    let recommendation = 'Puedes continuar trabajando en esta conversación con total normalidad.';

    if (compactionDetected) {
      statusLevel = 'compacted';
      statusMessage = 'Compactado: Antigravity ha resumido el historial antiguo automáticamente.';
      recommendation = 'Los primeros mensajes se han comprimido. Si notas que olvida instrucciones iniciales, considera abrir un nuevo chat.';
    } else if (percentUsed >= 80) {
      statusLevel = 'critical';
      statusMessage = 'Sobrecargado: Consumo alto de ventana de contexto (>80%).';
      recommendation = 'Alta probabilidad de lentitud o pérdida de detalle fino (Lost in the middle). Es momento ideal para cambiar de chat.';
    } else if (percentUsed >= 55) {
      statusLevel = 'heavy';
      statusMessage = 'Pesado: El chat acumula volumen considerable de código y herramientas.';
      recommendation = 'Completa el hito actual y te recomendamos abrir un nuevo chat para la siguiente tarea.';
    } else if (percentUsed >= 25) {
      statusLevel = 'moderate';
      statusMessage = 'Moderado: Uso saludable de tokens. Buen rendimiento.';
      recommendation = 'Todo en orden. No hay necesidad de cambiar de chat.';
    }

    return {
      conversationId,
      hasData: true,
      version: CURRENT_VERSION,
      currentTokens,
      currentInputTokens,
      currentCacheTokens,
      currentOutputTokens,
      cumulativeOutputTokens,
      maxTokens,
      percentUsed: parseFloat(percentUsed.toFixed(2)),
      detectedModel,
      totalSteps,
      userPromptCount,
      modelTurnCount,
      toolCallCount,
      compactionDetected,
      compactionTurn,
      statusLevel,
      statusMessage,
      recommendation,
      recentEvents: recentEvents.slice(-6).reverse(),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      conversationId,
      hasData: false,
      version: CURRENT_VERSION,
      error: `Error al leer la transcripción: ${err.message}`,
    };
  }
}

app.api('/api/context', (data) => {
  const conversationId = data.conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID;
  return analyzeConversationContext(conversationId);
}, 'GET');

app.api('/api/context', (data) => {
  const conversationId = data.conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID;
  return analyzeConversationContext(conversationId);
}, 'POST');

// Handover summary endpoint
app.api('/api/handover-summary', (data) => {
  const conversationId = data.conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID;
  return generateHandoverSummary(conversationId);
}, 'GET');

app.api('/api/handover-summary', (data) => {
  const conversationId = data.conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID;
  return generateHandoverSummary(conversationId);
}, 'POST');

// Check update endpoint
app.api('/api/check-update', async () => {
  try {
    const url = `${RAW_BASE_URL}/plugin.json?_t=${Date.now()}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Antigravity-Context-Monitor' } });
    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        message: 'No se pudo contactar con GitHub.',
      };
    }
    const remotePlugin = await res.json();
    const latestVersion = remotePlugin.version || CURRENT_VERSION;
    const hasUpdate = latestVersion !== CURRENT_VERSION;

    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      message: hasUpdate ? `Nueva versión ${latestVersion} disponible!` : 'Tienes la versión más reciente.',
    };
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      message: `Error al verificar actualizaciones: ${err.message}`,
    };
  }
}, 'GET');

// Apply update endpoint
app.api('/api/apply-update', async () => {
  const filesToUpdate = [
    { remote: 'plugin.json', local: join(PLUGIN_ROOT, 'plugin.json') },
    { remote: 'sidecars/panel/main.mjs', local: join(HERE, 'main.mjs') },
    { remote: 'sidecars/panel/index.html', local: join(HERE, 'index.html') },
    { remote: 'sidecars/panel/app.js', local: join(HERE, 'app.js') },
    { remote: 'sidecars/panel/styles.css', local: join(HERE, 'styles.css') },
    { remote: 'sidecars/panel/sidecar.json', local: join(HERE, 'sidecar.json') },
    { remote: 'sidecars/panel/package.json', local: join(HERE, 'package.json') },
  ];

  try {
    for (const f of filesToUpdate) {
      const url = `${RAW_BASE_URL}/${f.remote}?_t=${Date.now()}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        mkdirSync(dirname(f.local), { recursive: true });
        writeFileSync(f.local, text, 'utf8');
      }
    }
    return {
      success: true,
      message: '¡Archivos actualizados correctamente desde GitHub! Recarga el panel para ver los cambios.',
    };
  } catch (err) {
    return {
      success: false,
      message: `Error al aplicar la actualización: ${err.message}`,
    };
  }
}, 'POST');

app.run();
