/* ============================================================
   Калькулятор — логика (ПР №4)
   Пункты 4–7:
     4. получение значений из полей и приведение к числу;
     5. функции арифметических операций;
     6. обработчики кнопок операций;
     7. вывод результата в отдельный блок.
   ============================================================ */

'use strict';

/* ---------- Ссылки на элементы страницы ---------- */

const operationsEl = document.getElementById('operations');
const resetButton = document.getElementById('reset');
const inputA = document.getElementById('num1');
const inputB = document.getElementById('num2');
const resultEl = document.getElementById('result');

const RESULT_PLACEHOLDER = '—';

/* ---------- Пункт 5. Функции операций ---------- */

function add(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}

function mul(a, b) {
  return a * b;
}

function div(a, b) {
  return a / b;
}

const OPERATIONS = {
  add: { sign: '+', calculate: add },
  sub: { sign: '−', calculate: sub },
  mul: { sign: '×', calculate: mul },
  div: { sign: '÷', calculate: div },
};

/* ---------- Пункт 4. Получение значений ---------- */

/**
 * Читает поле ввода и возвращает число.
 * Пустое поле и нечисловой ввод дают null.
 */
function readNumber(input) {
  const raw = input.value.trim();

  if (raw === '') {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
}

/* ---------- Пункт 7. Вывод результата ---------- */

function showResult(text) {
  resultEl.textContent = text;
  resultEl.classList.remove('is-error');
}

function showError(text) {
  resultEl.textContent = text;
  resultEl.classList.add('is-error');
}

/**
 * Приводит число к короткому виду,
 * чтобы 0.1 + 0.2 не превращалось в 0.30000000000000004.
 */
function formatNumber(value) {
  return String(Number(value.toPrecision(12)));
}

/* ---------- Пункты 6–7. Обработка события и вывод ---------- */

function handleOperationClick(event) {
  const button = event.target.closest('.operation');

  if (!button) {
    return;
  }

  const operation = OPERATIONS[button.dataset.op];

  if (!operation) {
    return;
  }

  const a = readNumber(inputA);
  const b = readNumber(inputB);

  if (a === null || b === null) {
    showError('Введите оба числа.');
    return;
  }

  if (button.dataset.op === 'div' && b === 0) {
    showError('Деление на ноль невозможно.');
    return;
  }

  const result = operation.calculate(a, b);

  showResult(`${formatNumber(a)} ${operation.sign} ${formatNumber(b)} = ${formatNumber(result)}`);
}

operationsEl.addEventListener('click', handleOperationClick);

/* ---------- Сброс ---------- */

function handleReset() {
  inputA.value = '';
  inputB.value = '';
  resultEl.textContent = RESULT_PLACEHOLDER;
  resultEl.classList.remove('is-error');
  inputA.focus();
}

resetButton.addEventListener('click', handleReset);
