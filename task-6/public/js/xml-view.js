import { escapeHtml, highlightFlights, setXmlDetails, state } from './store.js';

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
  const sourceSelect = document.querySelector('#xml-source');
  const targetSelect = document.querySelector('#xml-target');
  const extractButton = document.querySelector('#xml-extract');
  const moveButton = document.querySelector('#xml-move');
  const resultElement = document.querySelector('#xml-result');

  for (const terminal of TERMINALS) {
    sourceSelect.append(new Option(terminal, terminal));
    targetSelect.append(new Option(terminal, terminal));
  }

  sourceSelect.value = 'A';
  targetSelect.value = 'D';

  extractButton.addEventListener('click', async () => {
    const document = await ensureXmlDocument(resultElement);
    const terminal = sourceSelect.value;
    const nodes = flightsByTerminal(document, terminal);

    renderExtraction(resultElement, nodes, terminal);
  });

  moveButton.addEventListener('click', async () => {
    const document = await ensureXmlDocument(resultElement);
    const source = sourceSelect.value;
    const target = targetSelect.value;

    if (source === target) {
      resultElement.innerHTML = '<p class="empty-state">Исходный и целевой терминал совпадают.</p>';
      return;
    }

    const nodes = flightsByTerminal(document, source);
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

    if (changedIds.length > 0) {
      const details = new Map(state.xmlDetails);

      for (const id of changedIds) {
        const current = details.get(id) ?? { terminal: '', checkIn: '' };
        details.set(id, { ...current, terminal: target });
      }

      setXmlDetails(details);
      highlightFlights(changedIds);
    }

    renderModification(resultElement, { source, target, count: nodes.length });
  });
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
    <div class="table-wrap">
      <table class="flights-table">
        <thead>
          <tr>
            <th scope="col">Рейс</th>
            <th scope="col">Терминал</th>
            <th scope="col">Стойки регистрации</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="flights-summary">Извлечено из XML: ${nodes.length} рейсов в терминале ${escapeHtml(terminal)}</p>
  `;
}

function renderModification(container, { source, target, count }) {
  const note =
    count === 0
      ? `В терминале ${escapeHtml(source)} рейсов нет — изменения не внесены.`
      : `Терминал изменён: ${escapeHtml(source)} → ${escapeHtml(target)}, рейсов — ${count}. Изменения подсвечены в таблице расписания.`;

  container.innerHTML = `<p class="xml-result__note">${note}</p>`;
}

function textOf(node, tagName) {
  return node.querySelector(tagName)?.textContent.trim() ?? '';
}
