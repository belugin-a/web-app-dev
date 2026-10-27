import { setFlights } from './store.js';

export const JSON_SOURCE = 'data/flights.json';

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

  return data.flights.length;
}
