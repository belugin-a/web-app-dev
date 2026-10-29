/* Фильтрация и агрегаты. Модуль не трогает DOM: только данные. */
(function (global) {
  'use strict';

  var MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  var MONTH_RANGES = {
    all: [0, 11],
    q1: [0, 2],
    q2: [3, 5],
    q3: [6, 8],
    q4: [9, 11],
    h1: [0, 5],
    h2: [6, 11],
  };

  var PERIODS = Object.keys(MONTH_RANGES);

  function monthIndex(date) {
    return Number(date.slice(5, 7)) - 1;
  }

  function inPeriod(month, period) {
    var range = MONTH_RANGES[period] || MONTH_RANGES.all;
    return month >= range[0] && month <= range[1];
  }

  function filterFlights(flights, options) {
    var opts = options || {};
    var airline = opts.airline || 'all';
    var period = opts.period || 'all';

    return flights.filter(function (flight) {
      return (
        (airline === 'all' || flight.airline === airline) &&
        inPeriod(monthIndex(flight.date), period)
      );
    });
  }

  function byMonth(flights, period) {
    var counts = new Array(12).fill(0);
    var passengers = new Array(12).fill(0);

    flights.forEach(function (flight) {
      var month = monthIndex(flight.date);
      counts[month] += 1;
      passengers[month] += flight.passengers;
    });

    var range = MONTH_RANGES[period] || MONTH_RANGES.all;
    var from = range[0];
    var to = range[1] + 1;

    return {
      labels: MONTHS.slice(from, to),
      flights: counts.slice(from, to),
      passengers: passengers.slice(from, to),
    };
  }

  function byAirline(flights) {
    var sums = {};

    flights.forEach(function (flight) {
      sums[flight.airline] = (sums[flight.airline] || 0) + flight.passengers;
    });

    var rows = Object.keys(sums)
      .map(function (label) {
        return { label: label, value: sums[label] };
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });

    return {
      labels: rows.map(function (row) {
        return row.label;
      }),
      passengers: rows.map(function (row) {
        return row.value;
      }),
    };
  }

  function kpi(flights) {
    var totalFlights = flights.length;
    var totalPassengers = 0;
    var totalDelay = 0;

    flights.forEach(function (flight) {
      totalPassengers += flight.passengers;
      totalDelay += flight.delayMin;
    });

    var avgDelay = totalFlights ? Math.round((totalDelay / totalFlights) * 10) / 10 : 0;

    return {
      totalFlights: totalFlights,
      totalPassengers: totalPassengers,
      avgDelay: avgDelay,
    };
  }

  global.PR7 = global.PR7 || {};
  global.PR7.aggregate = {
    MONTHS: MONTHS,
    PERIODS: PERIODS,
    filterFlights: filterFlights,
    byMonth: byMonth,
    byAirline: byAirline,
    kpi: kpi,
  };
})(window);
