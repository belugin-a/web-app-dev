'use strict';

/* ============================================================
   Викторина по основам веб-разработки — ПР №3
   Один вопрос на экране. Клик по плашке сразу показывает
   верно/неверно, счётчик верных растёт, «Далее» ведёт дальше.
   ============================================================ */

/* ---------- 1. Данные ---------- */

const QUIZ = {
  questions: [
    {
      text: 'Какой тег задаёт главный заголовок страницы?',
      options: [
        { text: '<h1>', code: true },
        { text: '<head>', code: true },
        { text: '<title>', code: true },
      ],
      correct: 0,
    },
    {
      text: 'Для чего нужен атрибут alt у изображения?',
      options: [
        { text: 'Задаёт адрес файла изображения' },
        { text: 'Показывает текст, если изображение не загрузилось' },
        { text: 'Управляет размером изображения' },
      ],
      correct: 1,
    },
    {
      text: 'Какое свойство меняет цвет текста?',
      options: [
        { text: 'background-color', code: true },
        { text: 'font-weight', code: true },
        { text: 'color', code: true },
      ],
      correct: 2,
    },
    {
      text: 'Какие элементы выберет селектор .card?',
      options: [
        { text: 'Все элементы <card>', code: true },
        { text: 'Элементы с class="card"' },
        { text: 'Элемент с id="card"' },
      ],
      correct: 1,
    },
    {
      text: 'Что вернёт document.querySelector(".btn")?',
      options: [
        { text: 'Первый элемент с классом btn' },
        { text: 'Все элементы с классом btn' },
        { text: 'Новый элемент <button>' },
      ],
      correct: 0,
    },
  ],
};

const TOTAL = QUIZ.questions.length;
const LETTERS = ['A', 'B', 'C'];

/* ---------- 2. Состояние ---------- */

const state = {
  index: 0,        // номер текущего вопроса
  score: 0,        // сколько верных ответов за прохождение
  answered: false, // ответ на текущий вопрос уже дан
};

/* ---------- 3. Элементы страницы ---------- */

const ui = {
  slide: document.querySelector('#quiz-slide'),
  step: document.querySelector('#quiz-step'),
  score: document.querySelector('#quiz-score'),
  question: document.querySelector('#quiz-question'),
  options: document.querySelector('#quiz-options'),
  feedback: document.querySelector('#quiz-feedback'),
  controls: document.querySelector('#quiz-controls'),
  next: document.querySelector('#quiz-next'),
  nextLabel: document.querySelector('#quiz-next-label'),
  result: document.querySelector('#quiz-result'),
  resultScore: document.querySelector('#result-score'),
  resultVerdict: document.querySelector('#result-verdict'),
  resultRestart: document.querySelector('#result-restart'),
  optionTemplate: document.querySelector('#option-template'),
};

/* ---------- 4. Рендер ---------- */

function createOption(option, index) {
  const button = ui.optionTemplate.content.firstElementChild.cloneNode(true);
  const textEl = button.querySelector('.option__text');

  button.dataset.index = String(index);
  button.querySelector('.option__key').textContent = LETTERS[index];

  if (option.code) {
    const code = document.createElement('code');
    code.textContent = option.text;
    textEl.append(code);
  } else {
    textEl.textContent = option.text;
  }

  button.setAttribute('aria-label', `Вариант ${LETTERS[index]}. ${option.text}`);

  return button;
}

function render(index) {
  const question = QUIZ.questions[index];

  state.index = index;
  state.answered = false;

  ui.step.textContent = `Вопрос ${index + 1} из ${TOTAL}`;
  ui.question.textContent = question.text;
  ui.options.replaceChildren(...question.options.map(createOption));

  ui.feedback.hidden = true;
  ui.feedback.className = 'slide__feedback';
  ui.feedback.textContent = '';

  ui.next.disabled = true;
  ui.nextLabel.textContent = index === TOTAL - 1 ? 'Результат' : 'Далее';

  ui.slide.hidden = false;

  ui.slide.classList.remove('slide--in');
  void ui.slide.offsetWidth; // сброс анимации перед повторным запуском
  ui.slide.classList.add('slide--in');
}

/* ---------- 5. События ---------- */

function onAnswerClick(event) {
  const button = event.target.closest('.option');
  if (!button || state.answered) return;

  const question = QUIZ.questions[state.index];
  const chosen = Number(button.dataset.index);
  const isCorrect = chosen === question.correct;

  state.answered = true;

  ui.options.querySelectorAll('.option').forEach((optionButton) => {
    const optionIndex = Number(optionButton.dataset.index);

    optionButton.disabled = true;

    if (optionIndex === question.correct) {
      optionButton.classList.add('is-correct');
    } else if (optionIndex === chosen) {
      optionButton.classList.add('is-wrong');
    } else {
      optionButton.classList.add('is-muted');
    }
  });

  if (isCorrect) {
    state.score += 1;
    ui.score.textContent = String(state.score);
  }

  ui.feedback.hidden = false;
  ui.feedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  ui.feedback.textContent = isCorrect
    ? 'Верно. Так держать.'
    : `Неверно. Правильный ответ — ${LETTERS[question.correct]}.`;

  ui.next.disabled = false;
  ui.next.focus({ preventScroll: true });
}

function onNext() {
  if (!state.answered) return;

  if (state.index + 1 >= TOTAL) {
    finish();
    return;
  }

  render(state.index + 1);
  ui.options.firstElementChild?.focus({ preventScroll: true });
}

function finish() {
  ui.slide.hidden = true;
  ui.controls.hidden = true;
  ui.result.hidden = false;

  ui.step.textContent = 'Викторина завершена';
  ui.resultScore.textContent = String(state.score);
  ui.resultVerdict.textContent = getVerdict(state.score, TOTAL);

  ui.resultRestart.focus({ preventScroll: true });
}

function restart() {
  state.index = 0;
  state.score = 0;
  state.answered = false;

  ui.score.textContent = '0';
  ui.result.hidden = true;
  ui.controls.hidden = false;

  render(0);
  ui.options.firstElementChild?.focus({ preventScroll: true });
}

/* ---------- 6. Вспомогательные функции ---------- */

function getVerdict(score, total) {
  if (score === total) return 'Все ответы верные — отличный результат.';
  if (score >= total - 1) return 'Почти всё верно: одна ошибка, но база уже есть.';
  if (score >= Math.ceil(total / 2)) return 'Больше половины верно: основы знакомы, детали стоит повторить.';
  return 'Пока мало верных ответов — есть смысл перечитать материал и пройти викторину снова.';
}

/* ---------- 7. Старт ---------- */

if (
  ui.slide && ui.step && ui.score && ui.question && ui.options && ui.feedback &&
  ui.controls && ui.next && ui.nextLabel && ui.result && ui.resultScore &&
  ui.resultVerdict && ui.resultRestart && ui.optionTemplate
) {
  render(0);

  ui.options.addEventListener('click', onAnswerClick);
  ui.next.addEventListener('click', onNext);
  ui.resultRestart.addEventListener('click', restart);
}
