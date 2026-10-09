// Frontend controller for Context Monitor sidecar UI
const sidecar = window.sidecar;

const $ = (id) => document.getElementById(id);

let pollInterval = null;
let lastData = null;

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString();
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// Copy to clipboard with robust iframe fallback
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    // Method 1: document.execCommand with temporary textarea
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (success) {
        resolve();
        return;
      }
    } catch {
      // Fall through to navigator.clipboard
    }

    // Method 2: navigator.clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(resolve).catch(reject);
      return;
    }

    reject(new Error('Portapapeles no soportado en este entorno'));
  });
}

async function callApi(path, { method = 'GET', body } = {}) {
  const res = await sidecar.fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function getProgressColor(statusLevel) {
  switch (statusLevel) {
    case 'optimal': return '#4ade80'; // Green
    case 'moderate': return '#facc15'; // Yellow
    case 'heavy': return '#fb923c'; // Orange
    case 'critical': return '#f87171'; // Red
    case 'compacted': return '#c084fc'; // Purple
    default: return '#38bdf8'; // Blue
  }
}

function getStatusIconSvg(statusLevel) {
  switch (statusLevel) {
    case 'optimal':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
    case 'moderate':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    case 'heavy':
    case 'critical':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    case 'compacted':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/></svg>`;
  }
}

async function refreshContext() {
  const convoId = sidecar?.conversationId;
  const convoDisplay = $('convo-id-display');
  if (convoDisplay) {
    convoDisplay.textContent = convoId ? `ID: ${convoId.slice(0, 8)}...` : 'ID: Activo';
  }

  try {
    const data = await callApi('/api/context', {
      method: 'POST',
      body: { conversationId: convoId },
    });

    lastData = data;
    renderData(data);
  } catch (err) {
    console.error('Error al actualizar métricas:', err);
    $('status-title').textContent = 'Error de lectura';
    $('status-message').textContent = err.message || 'No se pudo comunicar con el sidecar.';
  }
}

function renderData(data) {
  if (!data) return;

  const current = data.currentTokens || 0;
  const max = data.maxTokens || 1048576;
  const percent = Math.min(100, Math.max(0, data.percentUsed || 0));
  const remaining = Math.max(0, max - current);

  // Update Tokens Display
  $('tokens-current').textContent = formatNumber(current);
  $('tokens-max').textContent = formatNumber(max);
  $('percent-label').textContent = `${percent}% usado`;
  $('tokens-remaining').textContent = `${formatNumber(remaining)} libres`;

  // Update Progress Bar
  const progressBar = $('progress-bar');
  progressBar.style.width = `${Math.max(percent, 2)}%`;
  progressBar.style.backgroundColor = getProgressColor(data.statusLevel);

  // Model tag
  $('model-tag').textContent = data.detectedModel || 'Gemini Flash';

  // Version tag
  if (data.version && $('version-tag')) {
    $('version-tag').textContent = `v${data.version}`;
  }

  // Status Card & Icon
  const statusCard = $('status-card');
  statusCard.className = `diagnostic-card ${data.statusLevel || 'optimal'}`;

  const iconWrap = $('status-icon-wrap');
  if (iconWrap) {
    iconWrap.innerHTML = getStatusIconSvg(data.statusLevel);
  }

  const titles = {
    optimal: 'Óptimo (Rendimiento Alto)',
    moderate: 'Moderado (En Rango Normal)',
    heavy: 'Pesado (Atención Recomendada)',
    critical: 'Sobrecargado (Cambio Urgente)',
    compacted: 'Compactado por el Sistema',
  };

  $('status-title').textContent = titles[data.statusLevel] || 'Estado';
  $('status-message').textContent = data.statusMessage || '';
  $('recommendation-text').textContent = data.recommendation || 'Sin recomendaciones.';

  // Detailed Stats Grid
  $('stat-cache').textContent = formatNumber(data.currentCacheTokens || 0);
  $('stat-output').textContent = formatNumber(data.cumulativeOutputTokens || 0);
  $('stat-turns').textContent = `${data.userPromptCount || 0} / ${data.modelTurnCount || 0}`;
  $('stat-tools').textContent = formatNumber(data.toolCallCount || 0);

  // Recent Events
  const eventsContainer = $('events-list');
  if (data.recentEvents && data.recentEvents.length > 0) {
    eventsContainer.innerHTML = '';
    data.recentEvents.forEach(evt => {
      const item = document.createElement('div');
      item.className = 'event-item';

      const typeClass = `event-type-${evt.type || 'model'}`;
      const timeStr = evt.time ? new Date(evt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

      item.innerHTML = `
        <div class="event-top">
          <span class="${typeClass}">#${evt.stepIndex} ${escapeHtml(evt.label)}</span>
          <span style="opacity: 0.55; font-size: 10px;">${timeStr}</span>
        </div>
        ${evt.detail ? `<div class="event-detail">${escapeHtml(evt.detail)}</div>` : ''}
      `;
      eventsContainer.appendChild(item);
    });
  } else {
    eventsContainer.innerHTML = '<div class="events-empty">Sin actividad reciente</div>';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

// Refresh button
$('btn-refresh')?.addEventListener('click', () => {
  refreshContext();
  toast('Métricas actualizadas');
});

// Copy Summary Button (with iframe fallback)
$('btn-copy-summary')?.addEventListener('click', async () => {
  if (!lastData) {
    toast('No hay datos disponibles para copiar', true);
    return;
  }
  const summaryText = `[Resumen de Contexto - Antigravity]
• Ventana de contexto: ${formatNumber(lastData.currentTokens)} / ${formatNumber(lastData.maxTokens)} tokens (${lastData.percentUsed}%)
• Estado: ${lastData.statusLevel?.toUpperCase()}
• Turnos: ${lastData.userPromptCount} usuario / ${lastData.modelTurnCount} agente
• Diagnóstico: ${lastData.statusMessage}
• Recomendación: ${lastData.recommendation}`;

  try {
    await copyToClipboard(summaryText);
    toast('Copiado al portapapeles');
  } catch (err) {
    console.error('Error al copiar:', err);
    toast('No se pudo copiar automáticamente', true);
  }
});

// Start New Chat Button
$('btn-new-chat')?.addEventListener('click', async () => {
  const btn = $('btn-new-chat');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
    </svg>
    <span>Iniciando nuevo chat...</span>
  `;

  try {
    if (sidecar?.agent?.startConversation) {
      const res = await sidecar.agent.startConversation('Iniciando una nueva sesión de trabajo con el contexto limpio.');
      const newConvoId = res?.response?.conversationId || res?.conversation_id || res?.conversationId;
      
      toast('Nuevo chat creado con éxito');

      if (newConvoId && sidecar?.ui?.toggleConversation) {
        sidecar.ui.toggleConversation(newConvoId);
      }
    } else {
      toast('Crea un nuevo chat usando el botón "+" en la barra izquierda.');
    }
  } catch (err) {
    console.error('Error al iniciar conversación:', err);
    toast(`Error: ${err.message}`, true);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }, 1500);
  }
});

// Update checker
$('btn-check-update')?.addEventListener('click', async () => {
  const updateMsg = $('update-msg');
  const btn = $('btn-check-update');
  updateMsg.textContent = 'Verificando...';

  try {
    const res = await callApi('/api/check-update');
    if (res.hasUpdate) {
      updateMsg.textContent = `¡v${res.latestVersion} disponible!`;
      btn.textContent = 'Actualizar ahora';
      btn.style.color = '#4ade80';

      btn.onclick = async () => {
        btn.textContent = 'Descargando...';
        const applyRes = await callApi('/api/apply-update', { method: 'POST' });
        if (applyRes.success) {
          toast('Plugin actualizado. Recargando...');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          toast(applyRes.message, true);
        }
      };
    } else {
      updateMsg.textContent = 'Al día';
      toast('Ya tienes la versión más reciente.');
    }
  } catch (err) {
    updateMsg.textContent = 'Error';
    toast(`Error: ${err.message}`, true);
  }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  refreshContext();
  pollInterval = setInterval(refreshContext, 3000);
});

window.addEventListener('beforeunload', () => {
  if (pollInterval) clearInterval(pollInterval);
});
