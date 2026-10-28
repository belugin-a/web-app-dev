import { escapeHtml, highlightFlights, setXmlDetails, state } from './store.js';
import { setActionStatus } from './ui.js';

export const XML_SOURCE = 'data/flights.xml';

const TERMINALS = ['A', 'B', 'C', 'D'];

let xmlDocument = null;

export async function loadFlightsFromXml() {
  xmlDocument = await fetchXmlDocument();

  const details = buildDetails(xmlDocument);
  setXmlDetails(details);

  return details.size;
}

export function initXmlOperations() {
  const dialog = document.querySelector('#terminal-dialog');
  const openButton = document.querySelector('#open-terminal-dialog');
  const closeButton = document.querySelector('#close-terminal-dialog');
  const sourceSelect = document.querySelector('#xml-source');
  const targetSelect = document.querySelector('#xml-target');
  const extractButton = document.querySelector('#xml-extract');
  const moveButton = document.querySelector('#xml-move');
  const resultElement = document.querySelector('#xml-result');
  const statusElement = document.querySelector('#terminal-status');

  for (const terminal of TERMINALS) {
    sourceSelect.append(new Option(terminal, terminal));
    targetSelect.append(new Option(terminal, terminal));
  }

  sourceSelect.value = 'A';
  targetSelect.value = 'D';

  openButton.addEventListener('click', () => openTerminalDialog());

  closeButton.addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  extractButton.addEventListener('click', async () => {
    clearTerminalError(statusElement);

    try {
      const document = await ensureXmlDocument(resultElement);
      const terminal = sourceSelect.value;

      renderExtraction(resultElement, flightsByTerminal(document, terminal), terminal);
    } catch (error) {
      showTerminalError(statusElement, `Не удалось прочитать XML: ${error.message}`);
    }
  });

  moveButton.addEventListener('click', async () => {
    clearTerminalError(statusElement);

    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (source === target) {
      showTerminalError(statusElement, 'Выберите разные терминалы');
      return;
    }

    let document;

    try {
      document = await ensureXmlDocument(resultElement);
    } catch (error) {
      showTerminalError(statusElement, `Не удалось прочитать XML: ${error.message}`);
      return;
    }

    const nodes = flightsByTerminal(document, source);

    if (nodes.length === 0) {
      showTerminalError(statusElement, `В терминале ${source} рейсов нет`);
      return;
    }

    const changedIds = [];

    for (const node of nodes) {
      const terminalElement = node.querySelector('terminal');

      if (terminalElement) {
        terminalElement.textContent = target;
      }

      const id = node.getAttribute('id');

      if (id) {
        changedIds.push(id);
      }
    }

    const details = new Map(state.xmlDetails);

    for (const id of changedIds) {
      const current = details.get(id) ?? { terminal: '', checkIn: '' };
      details.set(id, { ...current, terminal: target });
    }

    setXmlDetails(details);
    highlightFlights(changedIds);

    dialog.close();
    setActionStatus(`Терминалы: ${source} → ${target}, рейсов — ${nodes.length}`);
  });

  document.querySelector('#flights').addEventListener('click', (event) => {
    const cell = event.target.closest('td[data-terminal]');

    if (!cell) {
      return;
    }

    openTerminalDialog(cell.dataset.terminal);
  });
}

export function openTerminalDialog(terminal) {
  const dialog = document.querySelector('#terminal-dialog');
  const sourceSelect = document.querySelector('#xml-source');
  const resultElement = document.querySelector('#xml-result');
  const statusElement = document.querySelector('#terminal-status');

  if (terminal && [...sourceSelect.options].some((option) => option.value === terminal)) {
    sourceSelect.value = terminal;
  }

  clearTerminalError(statusElement);
  resultElement.innerHTML = '<p class="empty-state">Выберите терминал и нажмите «Показать рейсы».</p>';

  if (!dialog.open) {
    dialog.showModal();
  }
}

async function ensureXmlDocument(resultElement) {
  if (xmlDocument) {
    return xmlDocument;
  }

  resultElement.innerHTML = '<p class="empty-state">Загрузка XML…</p>';
  await loadFlightsFromXml();

  return xmlDocument;
}

async function fetchXmlDocument() {
  const response = await fetch(XML_SOURCE, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`сервер вернул ${response.status}`);
  }

  const text = await response.text();
  const document = new DOMParser().parseFromString(text, 'application/xml');

  if (document.querySelector('parsererror')) {
    throw new Error('не удалось разобрать XML');
  }

  if (document.querySelectorAll('flight').length === 0) {
    throw new Error('в файле нет элементов flight');
  }

  return document;
}

function buildDetails(document) {
  const details = new Map();

  for (const node of document.querySelectorAll('flight')) {
    const id = node.getAttribute('id');

    if (!id) {
      continue;
    }

    details.set(id, {
      terminal: textOf(node, 'terminal'),
      checkIn: textOf(node, 'checkIn'),
    });
  }

  return details;
}

function flightsByTerminal(document, terminal) {
  return [...document.querySelectorAll('flight')].filter(
    (node) => textOf(node, 'terminal') === terminal,
  );
}

function renderExtraction(container, nodes, terminal) {
  if (nodes.length === 0) {
    container.innerHTML = `<p class="empty-state">В терминале ${escapeHtml(terminal)} рейсов нет.</p>`;
    return;
  }

  const rows = nodes
    .map(
      (node) => `
        <tr>
          <td class="flight-number">${escapeHtml(node.getAttribute('number') ?? node.getAttribute('id') ?? '')}</td>
          <td>${escapeHtml(textOf(node, 'terminal'))}</td>
          <td>${escapeHtml(textOf(node, 'checkIn'))}</td>
        </tr>`,
    )
    .join('');

  container.innerHTML = `
    <table class="flights-table">
      <thead>
        <tr>
          <th scope="col">Рейс</th>
          <th scope="col">Терминал</th>
          <th scope="col">Регистрация</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="flights-summary">Извлечено: ${nodes.length} рейсов в терминале ${escapeHtml(terminal)}</p>
  `;
}

function showTerminalError(statusElement, text) {
  statusElement.textContent = text;
  statusElement.classList.add('form-status--error');
}

function clearTerminalError(statusElement) {
  statusElement.textContent = '';
  statusElement.classList.remove('form-status--error');
}

function textOf(node, tagName) {
  return node.querySelector(tagName)?.textContent.trim() ?? '';
}
