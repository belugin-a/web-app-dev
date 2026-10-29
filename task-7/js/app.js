/* Связывание модулей: состояние фильтров, отрисовка, экспорт, раскладка. */
(function (global) {
  'use strict';

  var PR7 = global.PR7 || (global.PR7 = {});

  var state = {
    filters: { airline: 'all', period: 'all' },
    type: 'bar',
    charts: {},
  };

  var els = {};

  function formatNumber(value) {
    return Number(value).toLocaleString('ru-RU');
  }

  function compute() {
    var flights = global.FLIGHTS || [];
    var filtered = PR7.aggregate.filterFlights(flights, state.filters);

    return {
      month: PR7.aggregate.byMonth(filtered, state.filters.period),
      airlines: PR7.aggregate.byAirline(filtered),
      kpi: PR7.aggregate.kpi(filtered),
    };
  }

  function renderKpi(kpi) {
    els.kpiFlights.textContent = formatNumber(kpi.totalFlights);
    els.kpiPassengers.textContent = formatNumber(kpi.totalPassengers);
    els.kpiDelay.textContent = formatNumber(kpi.avgDelay) + ' мин';
  }

  function render() {
    var data = compute();

    PR7.charts.update(state.charts.flights, 'flights', data.month);
    PR7.charts.update(state.charts.passengers, 'passengers', data.month);
    PR7.charts.update(state.charts.airlines, 'airlines', data.airlines);

    renderKpi(data.kpi);
  }

  function resizeAll() {
    global.requestAnimationFrame(function () {
      Object.keys(state.charts).forEach(function (key) {
        state.charts[key].resize();
      });
    });
  }

  function toggleType(button) {
    var next = state.type === 'bar' ? 'line' : 'bar';
    var data = compute();

    state.type = next;
    state.charts.flights.destroy();
    state.charts.flights = PR7.charts.create('flights', els.canvasFlights, data.month, {
      type: next,
    });

    button.textContent = next === 'bar' ? 'Линия' : 'Столбцы';
    button.setAttribute('data-mode', next);
  }

  function exportPng(card) {
    var canvas = card.querySelector('canvas');
    if (!canvas) {
      return;
    }

    /* Белый фон: прозрачный PNG плохо читается в просмотрщиках с тёмной темой. */
    var output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;

    var ctx = output.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(canvas, 0, 0);

    var link = document.createElement('a');
    link.download = 'chart-' + card.getAttribute('data-id') + '.png';
    link.href = output.toDataURL('image/png');
    link.click();
  }

  function formatDate(iso) {
    var parts = iso.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function renderDataTable() {
    var flights = (global.FLIGHTS || []).slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });

    var fragment = document.createDocumentFragment();

    flights.forEach(function (flight) {
      var cells = [
        formatDate(flight.date),
        flight.airline,
        formatNumber(flight.passengers),
        formatNumber(flight.delayMin),
      ];

      var row = document.createElement('tr');

      cells.forEach(function (value, index) {
        var cell = document.createElement('td');
        cell.textContent = value;
        if (index >= 2) {
          cell.className = 'data-table__num';
        }
        row.appendChild(cell);
      });

      fragment.appendChild(row);
    });

    els.dataRows.replaceChildren(fragment);
    els.dataSubtitle.textContent =
      'Сырые записи без агрегации — ' + formatNumber(flights.length) + ' рейсов';
  }

  function openDataTable() {
    renderDataTable();
    if (typeof els.dataDialog.showModal === 'function') {
      els.dataDialog.showModal();
    } else {
      els.dataDialog.setAttribute('open', '');
    }
  }

  function closeDataTable() {
    if (typeof els.dataDialog.close === 'function') {
      els.dataDialog.close();
    } else {
      els.dataDialog.removeAttribute('open');
    }
  }

  function onClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    var action = button.getAttribute('data-action');

    if (action === 'toggle-type') {
      toggleType(button);
      return;
    }

    if (action === 'export') {
      exportPng(button.closest('.card'));
    }
  }

  function bind() {
    els.filters.addEventListener('submit', function (event) {
      event.preventDefault();
    });

    els.airline.addEventListener('change', function () {
      state.filters.airline = els.airline.value;
      render();
    });

    els.period.addEventListener('change', function () {
      state.filters.period = els.period.value;
      render();
    });

    els.reset.addEventListener('click', function () {
      PR7.layout.resetOrder(els.dashboard);
      resizeAll();
    });

    els.dashboard.addEventListener('click', onClick);
    PR7.layout.enableSwap(els.dashboard, resizeAll);

    els.openData.addEventListener('click', openDataTable);
    els.closeData.addEventListener('click', closeDataTable);
    els.dataDialog.addEventListener('click', function (event) {
      if (event.target === els.dataDialog) {
        closeDataTable();
      }
    });
  }

  function init() {
    els.dashboard = document.getElementById('dashboard');
    els.filters = document.getElementById('filters');
    els.airline = document.getElementById('airline-filter');
    els.period = document.getElementById('period-filter');
    els.reset = document.getElementById('reset-layout');
    els.canvasFlights = document.getElementById('chart-flights');
    els.kpiFlights = document.querySelector('[data-kpi="flights"]');
    els.kpiPassengers = document.querySelector('[data-kpi="passengers"]');
    els.kpiDelay = document.querySelector('[data-kpi="delay"]');
    els.openData = document.getElementById('open-data');
    els.closeData = document.getElementById('close-data');
    els.dataDialog = document.getElementById('data-dialog');
    els.dataRows = document.getElementById('data-rows');
    els.dataSubtitle = document.getElementById('data-dialog-subtitle');

    PR7.layout.restoreOrder(els.dashboard);

    var data = compute();

    state.charts.flights = PR7.charts.create('flights', els.canvasFlights, data.month, {
      type: state.type,
    });
    state.charts.passengers = PR7.charts.create(
      'passengers',
      document.getElementById('chart-passengers'),
      data.month,
    );
    state.charts.airlines = PR7.charts.create(
      'airlines',
      document.getElementById('chart-airlines'),
      data.airlines,
    );

    renderKpi(data.kpi);
    bind();
  }

  PR7.state = state;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
