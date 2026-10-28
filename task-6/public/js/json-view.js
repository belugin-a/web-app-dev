import { setFlights, setView } from './store.js';

export const JSON_SOURCE = 'data/flights.json';

const FLIGHT_STATUSES = [
  'По расписанию',
  'Регистрация',
  'Посадка',
  'Задержан',
  'Вылетел',
  'Отменён',
];

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

export function initJsonOperations() {
  const statusSelect = document.querySelector('#filter-status');
  const cityInput = document.querySelector('#filter-city');
  const sortSelect = document.querySelector('#sort-time');
  const resetButton = document.querySelector('#reset-view');

  for (const status of FLIGHT_STATUSES) {
    statusSelect.append(new Option(status, status));
  }

  const applyView = () => {
    setView({
      status: statusSelect.value,
      city: cityInput.value,
      sort: sortSelect.value,
    });
  };

  statusSelect.addEventListener('change', applyView);
  cityInput.addEventListener('input', applyView);
  sortSelect.addEventListener('change', applyView);

  resetButton.addEventListener('click', () => {
    resetJsonView();
  });

  applyView();
}

export function resetJsonView() {
  document.querySelector('#filter-status').value = 'all';
  document.querySelector('#filter-city').value = '';
  document.querySelector('#sort-time').value = 'none';

  setView({ status: 'all', city: '', sort: 'none' });
}
