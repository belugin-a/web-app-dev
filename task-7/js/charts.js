/* Конфигурация и обновление графиков Chart.js. Модуль не трогает DOM-события. */
(function (global) {
  'use strict';

  var PALETTE = ['#2f6fed', '#1f9d6b', '#e8a33d', '#d9534f', '#8b5cf6'];
  var MUTED = '#64748b';
  var GRID = 'rgba(148, 163, 184, 0.28)';
  var FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

  var numberFormat = new Intl.NumberFormat('ru-RU');

  function formatNumber(value) {
    return numberFormat.format(value);
  }

  /* Пустая выборка должна выглядеть как «нет данных», а не как пустой холст. */
  var emptyStatePlugin = {
    id: 'emptyState',
    afterDraw: function (chart) {
      var hasData = chart.data.datasets.some(function (dataset) {
        return dataset.data.some(function (value) {
          return Number(value) > 0;
        });
      });

      if (hasData) {
        return;
      }

      var area = chart.chartArea;
      if (!area) {
        return;
      }

      var ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'Нет данных за выбранный период',
        (area.left + area.right) / 2,
        (area.top + area.bottom) / 2,
      );
      ctx.restore();
    },
  };

  if (global.Chart) {
    global.Chart.register(emptyStatePlugin);
  }

  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 8, padding: 14, color: MUTED },
        },
        tooltip: {
          padding: 10,
          boxPadding: 4,
          callbacks: {
            label: function (context) {
              return ' ' + context.dataset.label + ': ' + formatNumber(context.parsed.y);
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: GRID },
          ticks: { color: MUTED },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: GRID },
          ticks: {
            color: MUTED,
            callback: function (value) {
              return formatNumber(value);
            },
          },
        },
      },
    };
  }

  function flightsConfig(data, type) {
    var isLine = type === 'line';
    var options = baseOptions();

    options.plugins.legend.display = false;

    return {
      type: type,
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Рейсы',
            data: data.flights,
            backgroundColor: isLine ? 'rgba(47, 111, 237, 0.12)' : 'rgba(47, 111, 237, 0.72)',
            borderColor: '#2f6fed',
            borderWidth: isLine ? 2 : 0,
            borderRadius: isLine ? 0 : 6,
            maxBarThickness: 42,
            fill: isLine,
            tension: 0.3,
            pointRadius: isLine ? 3 : 0,
            pointHoverRadius: 4,
            pointBackgroundColor: '#2f6fed',
          },
        ],
      },
      options: options,
    };
  }

  function passengersConfig(data) {
    var options = baseOptions();

    options.plugins.legend.display = false;

    return {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Пассажиры',
            data: data.passengers,
            backgroundColor: 'rgba(31, 157, 107, 0.14)',
            borderColor: '#1f9d6b',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 4,
            pointBackgroundColor: '#1f9d6b',
          },
        ],
      },
      options: options,
    };
  }

  function airlinesConfig(data) {
    return {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.passengers,
            backgroundColor: PALETTE,
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, boxWidth: 8, padding: 12, color: MUTED },
          },
          tooltip: {
            padding: 10,
            callbacks: {
              label: function (context) {
                return ' ' + context.label + ': ' + formatNumber(context.parsed) + ' чел.';
              },
            },
          },
        },
      },
    };
  }

  function buildConfig(kind, data, options) {
    if (kind === 'flights') {
      return flightsConfig(data, (options && options.type) || 'bar');
    }
    if (kind === 'passengers') {
      return passengersConfig(data);
    }
    return airlinesConfig(data);
  }

  function create(kind, canvas, data, options) {
    return new global.Chart(canvas, buildConfig(kind, data, options));
  }

  function update(chart, kind, data) {
    if (!chart) {
      return;
    }

    var values =
      kind === 'flights' ? data.flights : kind === 'passengers' ? data.passengers : data.passengers;

    chart.data.labels = data.labels.slice();
    chart.data.datasets[0].data = values.slice();
    chart.update();
  }

  global.PR7 = global.PR7 || {};
  global.PR7.charts = {
    PALETTE: PALETTE,
    create: create,
    update: update,
  };
})(window);
