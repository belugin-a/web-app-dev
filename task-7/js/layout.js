/* Раскладка дашборда: порядок карточек = раскладка. SortableJS со Swap-плагином. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'pr7:layout';
  var DEFAULT_ORDER = ['flights', 'passengers', 'airlines'];

  function isKnownOrder(order) {
    if (!Array.isArray(order) || order.length !== DEFAULT_ORDER.length) {
      return false;
    }

    var unique = order.filter(function (id, index) {
      return order.indexOf(id) === index;
    });

    if (unique.length !== DEFAULT_ORDER.length) {
      return false;
    }

    return unique.every(function (id) {
      return DEFAULT_ORDER.indexOf(id) !== -1;
    });
  }

  function readOrder() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return isKnownOrder(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeOrder(order) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (error) {
      /* localStorage может быть недоступен на file:// — раскладка просто не сохранится. */
    }
  }

  function clearOrder() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* см. writeOrder */
    }
  }

  function applyOrder(container, order) {
    order.forEach(function (id) {
      var card = container.querySelector('.card[data-id="' + id + '"]');
      if (card) {
        container.appendChild(card);
      }
    });
  }

  function restoreOrder(container) {
    var order = readOrder();
    if (order) {
      applyOrder(container, order);
    }
  }

  function enableSwap(container, onSwap) {
    var sortable = new global.Sortable(container, {
      swap: true,
      swapClass: 'card--swap-target',
      animation: 150,
      handle: '.card__handle',
      draggable: '.card',
      onEnd: function () {
        writeOrder(sortable.toArray());
        if (typeof onSwap === 'function') {
          onSwap();
        }
      },
    });

    return sortable;
  }

  function resetOrder(container) {
    clearOrder();
    applyOrder(container, DEFAULT_ORDER);
  }

  global.PR7 = global.PR7 || {};
  global.PR7.layout = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_ORDER: DEFAULT_ORDER,
    restoreOrder: restoreOrder,
    enableSwap: enableSwap,
    resetOrder: resetOrder,
  };
})(window);
