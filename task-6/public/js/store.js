const STATUS_MODIFIERS = {
  'По расписанию': 'scheduled',
  'Регистрация': 'check-in',
  'Посадка': 'boarding',
  'Задержан': 'delayed',
  'Вылетел': 'departed',
  'Отменён': 'cancelled',
};

export const state = {
  flights: [],
  totalCount: 0,
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function setFlights(flights) {
  state.flights = flights;
  state.totalCount = flights.length;
}

export function renderFlights() {
  const container = document.querySelector('#flights');

  if (state.flights.length === 0) {
    container.innerHTML = '<p class="empty-state">Данные ещё не загружены.</p>';
    return;
  }

  const rows = state.flights
    .map(
      (flight) => `
        <tr>
          <td class="flight-number">${escapeHtml(flight.number)}</td>
          <td>${escapeHtml(flight.airline)}</td>
          <td>${escapeHtml(flight.city)}</td>
          <td class="flight-time">${escapeHtml(flight.time)}</td>
          <td>${escapeHtml(flight.gate)}</td>
          <td><span class="status status--${statusModifier(flight.status)}">${escapeHtml(flight.status)}</span></td>
        </tr>`,
    )
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
            <th scope="col">Статус</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="flights-summary">Показано ${state.flights.length} из ${state.totalCount}</p>
  `;
}

function statusModifier(status) {
  return STATUS_MODIFIERS[status] ?? 'unknown';
}
