const STATUS_MODIFIERS = {
  'По расписанию': 'scheduled',
  'Регистрация': 'check-in',
  'Посадка': 'boarding',
  'Задержан': 'delayed',
  'Вылетел': 'departed',
  'Отменён': 'cancelled',
};

const HIGHLIGHT_DURATION = 2500;
const ADDED_HIGHLIGHT_DURATION = 4000;

export const state = {
  flights: [],
  totalCount: 0,
  loaded: false,
  xmlDetails: new Map(),
  view: {
    status: 'all',
    city: '',
    sort: 'none',
  },
};

const highlightedIds = new Set();
const addedIds = new Set();

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function setFlights(flights) {
  highlightedIds.clear();
  state.flights = flights;
  state.totalCount = flights.length;
  state.loaded = true;
  renderFlights();
}

export function setXmlDetails(details) {
  state.xmlDetails = details;

  if (state.loaded) {
    renderFlights();
  }
}

export function setView(patch) {
  state.view = { ...state.view, ...patch };

  if (state.loaded) {
    renderFlights();
  }
}

export function getVisibleFlights() {
  const { status, city, sort } = state.view;
  const cityQuery = city.trim().toLowerCase();

  const flights = state.flights.filter((flight) => {
    const matchesStatus = status === 'all' || flight.status === status;
    const matchesCity = cityQuery === '' || flight.city.toLowerCase().includes(cityQuery);

    return matchesStatus && matchesCity;
  });

  if (sort === 'asc') {
    return [...flights].sort((a, b) => a.time.localeCompare(b.time));
  }

  if (sort === 'desc') {
    return [...flights].sort((a, b) => b.time.localeCompare(a.time));
  }

  return flights;
}

export function replaceFlights(flights) {
  const previousStatuses = new Map(state.flights.map((flight) => [flight.id, flight.status]));

  for (const flight of flights) {
    if (previousStatuses.has(flight.id) && previousStatuses.get(flight.id) !== flight.status) {
      highlight(flight.id);
    }
  }

  state.flights = flights;
  state.totalCount = flights.length;

  if (state.loaded) {
    renderFlights();
  }
}

export function highlightFlights(ids) {
  for (const id of ids) {
    highlight(id);
  }

  if (state.loaded) {
    renderFlights();
  }
}

export function applyFlightUpdate(flight) {
  const index = state.flights.findIndex((item) => item.id === flight.id);

  if (index === -1) {
    state.flights.unshift(flight);
    state.totalCount = state.flights.length;
    markAdded(flight.id);
  } else {
    if (state.flights[index].status !== flight.status) {
      highlight(flight.id);
    }

    state.flights[index] = flight;
  }

  if (state.loaded) {
    renderFlights();
  }
}

export function renderFlights() {
  const container = document.querySelector('#flights');

  if (state.flights.length === 0) {
    container.innerHTML = '<p class="empty-state">Данные ещё не загружены.</p>';
    return;
  }

  const visibleFlights = getVisibleFlights();

  if (visibleFlights.length === 0) {
    container.innerHTML = `
      <p class="empty-state">По выбранным условиям рейсов не найдено.</p>
      <p class="flights-summary">Показано 0 из ${state.totalCount}${describeView()}</p>
    `;
    return;
  }

  const showXmlDetails = state.xmlDetails.size > 0;

  const rows = visibleFlights
    .map((flight) => {
      const details = state.xmlDetails.get(flight.id);

      return `
        <tr data-flight-id="${escapeHtml(flight.id)}" class="${[
          highlightedIds.has(flight.id) ? 'row--changed' : '',
          addedIds.has(flight.id) ? 'row--added' : '',
        ]
          .filter(Boolean)
          .join(' ')}">
          <td class="flight-number">${escapeHtml(flight.number)}</td>
          <td>${escapeHtml(flight.airline)}</td>
          <td>${escapeHtml(flight.city)}</td>
          <td class="flight-time">${escapeHtml(flight.time)}</td>
          <td>${escapeHtml(flight.gate)}</td>
          ${showXmlDetails ? `<td>${escapeHtml(details?.terminal ?? '—')}</td>` : ''}
          ${showXmlDetails ? `<td>${escapeHtml(details?.checkIn ?? '—')}</td>` : ''}
          <td><span class="status status--${statusModifier(flight.status)}">${escapeHtml(flight.status)}</span></td>
        </tr>`;
    })
    .join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="flights-table">
        <thead>
          <tr>
            <th scope="col">Рейс</th>
            <th scope="col">Авиакомпания</th>
            <th scope="col">Город</th>
            <th scope="col">Время</th>
            <th scope="col">Выход</th>
            ${showXmlDetails ? '<th scope="col">Терминал</th>' : ''}
            ${showXmlDetails ? '<th scope="col">Регистрация</th>' : ''}
            <th scope="col">Статус</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="flights-summary">Показано ${visibleFlights.length} из ${state.totalCount}${describeView()}</p>
  `;
}

function statusModifier(status) {
  return STATUS_MODIFIERS[status] ?? 'unknown';
}

function describeView() {
  const parts = [];

  if (state.view.status !== 'all') {
    parts.push(`статус «${state.view.status}»`);
  }

  if (state.view.city.trim() !== '') {
    parts.push(`город содержит «${escapeHtml(state.view.city.trim())}»`);
  }

  if (state.view.sort !== 'none') {
    parts.push(`сортировка по времени ${state.view.sort === 'asc' ? '↑' : '↓'}`);
  }

  return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
}

function highlight(flightId) {
  highlightedIds.add(flightId);

  setTimeout(() => {
    highlightedIds.delete(flightId);
    document
      .querySelector(`[data-flight-id="${CSS.escape(flightId)}"]`)
      ?.classList.remove('row--changed');
  }, HIGHLIGHT_DURATION);
}

function markAdded(flightId) {
  addedIds.add(flightId);

  setTimeout(() => {
    addedIds.delete(flightId);
    document
      .querySelector(`[data-flight-id="${CSS.escape(flightId)}"]`)
      ?.classList.remove('row--added');
  }, ADDED_HIGHLIGHT_DURATION);
}
