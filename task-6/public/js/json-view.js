import { renderFlights, setFlights } from './store.js';

const JSON_SOURCE = 'data/flights.json';

export async function loadFlightsFromJson() {
  const response = await fetch(JSON_SOURCE, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`сервер вернул ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.flights)) {
    throw new Error('в файле нет массива flights');
  }

  setFlights(data.flights);
  renderFlights();

  return data.flights.length;
}

export { JSON_SOURCE };
