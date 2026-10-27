import { setXmlDetails } from './store.js';

export const XML_SOURCE = 'data/flights.xml';

export async function loadFlightsFromXml() {
  const response = await fetch(XML_SOURCE, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`сервер вернул ${response.status}`);
  }

  const text = await response.text();
  const xmlDocument = new DOMParser().parseFromString(text, 'application/xml');

  if (xmlDocument.querySelector('parsererror')) {
    throw new Error('не удалось разобрать XML');
  }

  const flightNodes = [...xmlDocument.querySelectorAll('flight')];

  if (flightNodes.length === 0) {
    throw new Error('в файле нет элементов flight');
  }

  const details = new Map();

  for (const node of flightNodes) {
    const id = node.getAttribute('id');

    if (!id) {
      continue;
    }

    details.set(id, {
      terminal: textOf(node, 'terminal'),
      checkIn: textOf(node, 'checkIn'),
    });
  }

  setXmlDetails(details);

  return details.size;
}

function textOf(node, tagName) {
  return node.querySelector(tagName)?.textContent.trim() ?? '';
}
