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

/* Последняя нажатая операция — её же запускает Enter в поле ввода */
let lastOperationKey = 'add';

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
 * Разбирает поле ввода.
 * Возвращает объект со статусом: empty, invalid, overflow или ok + value.
 * Запятая принимается как десятичный разделитель (1,5 → 1.5).
 * Экспоненциальная запись («1e3») не поддерживается.
 */
function readNumber(input) {
  const raw = input.value.trim().replace(',', '.');

  if (raw === '') {
    return { status: 'empty' };
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw)) {
    return { status: 'invalid' };
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return { status: 'overflow' };
  }

  return { status: 'ok', value };
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
 * 15 значащих цифр — предел точности double, поэтому большие
 * целые (до 15 цифр) не теряют разряды.
 */
function formatNumber(value) {
  return String(Number(value.toPrecision(15)));
}

/* ---------- Пункты 6–7. Обработка события и вывод ---------- */

function calculate(operationKey) {
  const operation = OPERATIONS[operationKey];

  if (!operation) {
    return;
  }

  const a = readNumber(inputA);
  const b = readNumber(inputB);

  if (a.status === 'empty' || b.status === 'empty') {
    showError('Введите оба числа.');
    return;
  }

  if (a.status === 'invalid' || b.status === 'invalid') {
    showError('Некорректное число.');
    return;
  }

  if (a.status === 'overflow' || b.status === 'overflow') {
    showError('Слишком большое число.');
    return;
  }

  if (operationKey === 'div' && b.value === 0) {
    showError('Деление на ноль невозможно.');
    return;
  }

  const result = operation.calculate(a.value, b.value);

  if (!Number.isFinite(result)) {
    showError('Слишком большое число.');
    return;
  }

  showResult(
    `${formatNumber(a.value)} ${operation.sign} ${formatNumber(b.value)} = ${formatNumber(result)}`
  );
}

function handleOperationClick(event) {
  const button = event.target.closest('.operation');

  if (!button) {
    return;
  }

  const operationKey = button.dataset.op;

  if (!OPERATIONS[operationKey]) {
    return;
  }

  lastOperationKey = operationKey;
  calculate(operationKey);
}

/* Enter в любом поле запускает последнюю выбранную операцию */
function handleEnter(event) {
  if (event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  calculate(lastOperationKey);
}

/* В поля пускаем только цифры, точку/запятую и знаки +/−.
   Буква «e» (экспоненциальная запись) и прочие символы не вводятся. */
function handleNumberKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key.length === 1 && !/[0-9.,+-]/.test(event.key)) {
    event.preventDefault();
    showError('Можно вводить только цифры, «.»/«,» и знаки «+»/«−».');
  }
}

/* Любое изменение поля делает старый результат неактуальным */
function handleInputChange() {
  resultEl.textContent = RESULT_PLACEHOLDER;
  resultEl.classList.remove('is-error');
}

operationsEl.addEventListener('click', handleOperationClick);

[inputA, inputB].forEach((input) => {
  input.addEventListener('keydown', handleEnter);
  input.addEventListener('keydown', handleNumberKeydown);
  input.addEventListener('input', handleInputChange);
});

/* ---------- Сброс ---------- */

function handleReset() {
  inputA.value = '';
  inputB.value = '';
  resultEl.textContent = RESULT_PLACEHOLDER;
  resultEl.classList.remove('is-error');
  inputA.focus();
}

resetButton.addEventListener('click', handleReset);
