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
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
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
    case 'optimal': return '#a6e3a1'; // Green
    case 'moderate': return '#f9e2af'; // Yellow
    case 'heavy': return '#fab387'; // Orange
    case 'critical': return '#f38ba8'; // Red
    case 'compacted': return '#cba6f7'; // Purple
    default: return '#89b4fa'; // Blue
  }
}

async function refreshContext() {
  const convoId = sidecar?.conversationId;
  const convoDisplay = $('convo-id-display');
  if (convoDisplay) {
    convoDisplay.textContent = convoId ? `ID: ${convoId.slice(0, 8)}...` : 'ID: Global';
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
  $('percent-label').textContent = `${percent}% utilizado`;
  $('tokens-remaining').textContent = `${formatNumber(remaining)} disponibles`;

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

  // Status Card
  const statusCard = $('status-card');
  statusCard.className = `card status-card ${data.statusLevel || 'optimal'}`;

  const titles = {
    optimal: 'Óptimo (Rendimiento Alto)',
    moderate: 'Moderado (En Rango Normal)',
    heavy: 'Pesado (Atención Recomendada)',
    critical: 'Sobrecargado (Cambio Urgente)',
    compacted: 'Compactado por el Sistema',
  };

  $('status-title').textContent = titles[data.statusLevel] || 'Estado Desconocido';
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
          <span class="${typeClass}">Paso #${evt.stepIndex}: ${escapeHtml(evt.label)}</span>
          <span style="opacity: 0.6; font-size: 10px;">${timeStr}</span>
        </div>
        ${evt.detail ? `<div class="event-detail">${escapeHtml(evt.detail)}</div>` : ''}
      `;
      eventsContainer.appendChild(item);
    });
  } else {
    eventsContainer.innerHTML = '<div class="empty-events">Sin actividad reciente registrada</div>';
  }

  // Footer
  $('last-sync').textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Actions
$('btn-refresh')?.addEventListener('click', () => {
  refreshContext();
  toast('Métricas actualizadas');
});

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
    await navigator.clipboard.writeText(summaryText);
    toast('¡Resumen copiado al portapapeles!');
  } catch {
    toast('No se pudo acceder al portapapeles', true);
  }
});

$('btn-new-chat')?.addEventListener('click', async () => {
  if (confirm('¿Deseas iniciar una nueva conversación limpia para este workspace?')) {
    try {
      if (sidecar?.agent?.startConversation) {
        await sidecar.agent.startConversation('Hola, iniciamos una nueva sesión de trabajo con el contexto limpio.');
        toast('Iniciando nuevo chat...');
      } else {
        toast('Usa el botón de "+" en la barra lateral izquierda para un nuevo chat');
      }
    } catch (err) {
      toast(`Error: ${err.message}`, true);
    }
  }
});

// Update checker
$('btn-check-update')?.addEventListener('click', async () => {
  const updateMsg = $('update-msg');
  const actionContainer = $('update-action-container');
  updateMsg.textContent = 'Buscando...';

  try {
    const res = await callApi('/api/check-update');
    if (res.hasUpdate) {
      updateMsg.textContent = `¡v${res.latestVersion} disponible!`;
      actionContainer.innerHTML = `<button id="btn-update-now" class="btn-update-now">Actualizar ahora</button>`;

      $('btn-update-now')?.addEventListener('click', async () => {
        toast('Descargando actualización...');
        const applyRes = await callApi('/api/apply-update', { method: 'POST' });
        if (applyRes.success) {
          toast(applyRes.message);
          updateMsg.textContent = `Actualizado a v${res.latestVersion}`;
          actionContainer.innerHTML = '<span style="color:var(--success-color);">✓ Al día</span>';
          setTimeout(() => refreshContext(), 1000);
        } else {
          toast(applyRes.message, true);
        }
      });
    } else {
      updateMsg.textContent = 'Versión más reciente instalada';
      toast('Ya tienes la versión más reciente.');
    }
  } catch (err) {
    updateMsg.textContent = 'Error al comprobar';
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
