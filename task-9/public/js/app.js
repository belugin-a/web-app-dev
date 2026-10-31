/**
 * Одностраничное приложение «Заявки в IT-поддержку».
 *
 * Страница общается с сервером только асинхронными запросами:
 * список, сводка и справочники загружаются при старте и обновляются
 * после каждого изменения. Правила переходов статусов и сроки приходят
 * с сервера — здесь они не дублируются.
 */

import { api } from './api.js';

/* ------------------------------------------------------------------ */
/* Состояние страницы                                                  */
/* ------------------------------------------------------------------ */

const state = {
  meta: null,
  tickets: [],
  total: 0,
  stats: null,
  filters: {
    status: '',
    priority: '',
    assignee: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  editing: null,
};

const elements = {
  serverState: document.getElementById('server-state'),
  serverStateText: document.getElementById('server-state-text'),
  clock: document.getElementById('clock'),

  kpiTotal: document.getElementById('kpi-total'),
  kpiOpen: document.getElementById('kpi-open'),
  kpiOverdue: document.getElementById('kpi-overdue'),
  kpiOverdueCard: document.getElementById('kpi-overdue-card'),
  kpiAverage: document.getElementById('kpi-average'),

  pipeline: document.getElementById('pipeline'),
  slaSummary: document.getElementById('sla-summary'),

  boardBody: document.getElementById('board-body'),
  boardCount: document.getElementById('board-count'),

  filterSearch: document.getElementById('filter-search'),
  filterStatus: document.getElementById('filter-status'),
  filterPriority: document.getElementById('filter-priority'),
  filterAssignee: document.getElementById('filter-assignee'),
  filterSort: document.getElementById('filter-sort'),
  filterReset: document.getElementById('filter-reset'),

  createForm: document.getElementById('create-form'),
  createTitle: document.getElementById('create-title'),
  createDescription: document.getElementById('create-description'),
  createPriority: document.getElementById('create-priority'),
  createAssignee: document.getElementById('create-assignee'),
  createPriorityHint: document.getElementById('create-priority-hint'),
  createError: document.getElementById('create-error'),
  createSubmit: document.getElementById('create-submit'),

  editDialog: document.getElementById('edit-dialog'),
  editForm: document.getElementById('edit-form'),
  editTitle: document.getElementById('edit-title'),
  editSubtitle: document.getElementById('edit-subtitle'),
  editTitleInput: document.getElementById('edit-title-input'),
  editDescription: document.getElementById('edit-description'),
  editPriority: document.getElementById('edit-priority'),
  editAssignee: document.getElementById('edit-assignee'),
  editPriorityHint: document.getElementById('edit-priority-hint'),
  editError: document.getElementById('edit-error'),
  editCancel: document.getElementById('edit-cancel'),

  toasts: document.getElementById('toasts'),
};

/* ------------------------------------------------------------------ */
/* Вспомогательные функции                                             */
/* ------------------------------------------------------------------ */

const STATUS_CLASS = {
  'новая': 'pill--normal',
  'в работе': 'pill--high',
  'ожидает': 'pill--sla',
  'решена': 'pill--done',
  'закрыта': 'pill--low',
};

const PRIORITY_CLASS = {
  'низкий': 'pill--low',
  'обычный': 'pill--normal',
  'высокий': 'pill--high',
  'критичный': 'pill--critical',
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

/** Показывает всплывающее уведомление. */
function toast(message, kind = 'success') {
  const node = document.createElement('div');
  node.className = kind === 'error' ? 'toast toast--error' : kind === 'info' ? 'toast toast--info' : 'toast';
  node.textContent = message;

  elements.toasts.append(node);

  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 200ms ease';
    setTimeout(() => node.remove(), 220);
  }, 3200);
}

/** Форматирует дату в понятный вид. */
function formatDate(value) {
  return dateFormatter.format(new Date(value));
}

/** Форматирует «сколько осталось до срока». */
function formatSla(ticket) {
  if (ticket.isOverdue) {
    const overdueHours = Math.round((Date.now() - new Date(ticket.dueAt).getTime()) / 3600_000);

    return `просрочена на ${overdueHours} ч`;
  }

  const leftHours = Math.round((new Date(ticket.dueAt).getTime() - Date.now()) / 3600_000);

  if (leftHours <= 0) {
    return 'срок на исходе';
  }

  return `осталось ${leftHours} ч из ${ticket.slaHours}`;
}

/** Создаёт элемент с текстом и классами. */
function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

/* ------------------------------------------------------------------ */
/* Отрисовка                                                           */
/* ------------------------------------------------------------------ */

function renderStats() {
  const stats = state.stats;

  if (!stats) {
    return;
  }

  elements.kpiTotal.textContent = stats.total;
  elements.kpiOpen.textContent = stats.open;
  elements.kpiOverdue.textContent = stats.overdue;
  elements.kpiAverage.textContent = stats.averageHours > 0 ? `${stats.averageHours} ч` : '—';

  elements.kpiOverdueCard.classList.toggle('kpi--alert', stats.overdue > 0);
  elements.kpiOverdue.nextElementSibling.textContent = stats.overdue
    ? 'вышли за срок обработки'
    : 'все в срок';
}

function renderPipeline() {
  const stats = state.stats;

  if (!stats) {
    return;
  }

  const statuses = state.meta?.statuses ?? [];
  const max = Math.max(1, ...Object.values(stats.byStatus));

  elements.pipeline.replaceChildren(
    ...statuses.map((status) => {
      const count = stats.byStatus[status] ?? 0;
      const item = el('li', 'pipeline__item');

      item.append(el('span', 'pipeline__name', status));
      item.append(el('span', 'pipeline__count', String(count)));

      const bar = el('div', 'pipeline__bar');
      const fill = el('div', 'pipeline__bar-fill');
      fill.style.width = `${(count / max) * 100}%`;
      bar.append(fill);
      item.append(bar);

      return item;
    }),
  );

  const sla = state.meta?.slaHours ?? {};
  elements.slaSummary.textContent = Object.entries(sla)
    .map(([priority, hours]) => `${priority} — ${hours} ч`)
    .join(' · ');
}

/** Собирает карточку заявки. */
function renderTicket(ticket) {
  const node = el('article', 'ticket');
  node.dataset.priority = ticket.priority;
  node.dataset.status = ticket.status;

  if (ticket.isOverdue) {
    node.classList.add('ticket--overdue');
  }

  const top = el('div', 'ticket__top');
  top.append(el('span', 'ticket__id', `№${String(ticket.id).padStart(3, '0')}`));
  top.append(el('h3', 'ticket__title', ticket.title));

  const statusPill = el('span', `pill pill--status ${STATUS_CLASS[ticket.status] ?? ''}`, ticket.status);
  const priorityPill = el(
    'span',
    `pill ${PRIORITY_CLASS[ticket.priority] ?? ''}`,
    ticket.priority,
  );

  top.append(priorityPill);
  top.append(statusPill);

  if (ticket.isOverdue) {
    top.append(el('span', 'pill pill--overdue', formatSla(ticket)));
  } else if (ticket.status !== 'решена' && ticket.status !== 'закрыта') {
    top.append(el('span', 'pill pill--sla', formatSla(ticket)));
  }

  node.append(top);

  if (ticket.description) {
    node.append(el('p', 'ticket__description', ticket.description));
  }

  const meta = el('div', 'ticket__meta');
  meta.append(el('span', null, 'Исполнитель: '));
  meta.append(el('b', null, ticket.assignee || 'не назначен'));
  meta.append(el('span', null, `Создана ${formatDate(ticket.createdAt)}`));
  meta.append(el('span', null, `Обновлена ${formatDate(ticket.updatedAt)}`));
  node.append(meta);

  node.append(renderActions(ticket));

  return node;
}

/** Кнопки действий для заявки: только разрешённые сервером переходы. */
function renderActions(ticket) {
  const actions = el('div', 'ticket__actions');

  const transitions = state.meta?.transitions?.[ticket.status] ?? [];

  if (transitions.length) {
    actions.append(el('span', 'ticket__actions-label', 'Перевести в:'));

    for (const status of transitions) {
      const button = el('button', 'btn btn--sm', status);
      button.type = 'button';
      button.addEventListener('click', () => onChangeStatus(ticket, status));

      actions.append(button);
    }
  } else {
    actions.append(el('span', 'ticket__actions-label', 'Заявка закрыта — дальнейших переходов нет'));
  }

  const edit = el('button', 'btn btn--link', 'Редактировать');
  edit.type = 'button';
  edit.addEventListener('click', () => openEditDialog(ticket));
  actions.append(edit);

  if (ticket.status === 'новая') {
    const remove = el('button', 'btn btn--link', 'Удалить');
    remove.type = 'button';
    remove.addEventListener('click', () => onDelete(ticket));
    actions.append(remove);
  }

  return actions;
}

function renderBoard() {
  if (!state.tickets.length) {
    elements.boardBody.replaceChildren(
      el('p', 'empty', 'Заявок по текущим условиям нет. Измените фильтры или создайте новую заявку.'),
    );
  } else {
    elements.boardBody.replaceChildren(...state.tickets.map(renderTicket));
  }

  const shown = state.tickets.length;
  elements.boardCount.textContent =
    shown === state.total ? `всего ${state.total}` : `показано ${shown} из ${state.total}`;
}

/* ------------------------------------------------------------------ */
/* Загрузка данных                                                     */
/* ------------------------------------------------------------------ */

async function loadTickets() {
  elements.boardBody.replaceChildren(
    el('p', 'loading', [el('span', 'spinner'), 'Загружаю заявки…']),
  );

  try {
    const result = await api.listTickets(state.filters);

    state.tickets = result.items;
    state.total = result.total;

    renderBoard();
  } catch (error) {
    elements.boardBody.replaceChildren(el('p', 'empty', `Не удалось загрузить заявки: ${error.message}`));
    toast(error.message, 'error');
  }
}

async function loadStats() {
  try {
    state.stats = await api.stats();

    renderStats();
    renderPipeline();
  } catch (error) {
    console.error(error);
  }
}

/** Перезагружает и список, и сводку — после любого изменения. */
async function refresh() {
  await Promise.all([loadTickets(), loadStats()]);
}

/* ------------------------------------------------------------------ */
/* Действия                                                            */
/* ------------------------------------------------------------------ */

async function onChangeStatus(ticket, status) {
  try {
    await api.changeStatus(ticket.id, status);
    toast(`Заявка №${ticket.id}: статус «${status}»`);
    await refresh();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function onDelete(ticket) {
  const confirmed = window.confirm(
    `Удалить заявку №${ticket.id}?\n\n«${ticket.title}»\n\nУдалить можно только заявки в статусе «новая».`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await api.deleteTicket(ticket.id);
    toast(`Заявка №${ticket.id} удалена`);
    await refresh();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function onCreate(event) {
  event.preventDefault();

  elements.createError.hidden = true;
  elements.createSubmit.disabled = true;

  const payload = {
    title: elements.createTitle.value,
    description: elements.createDescription.value,
    priority: elements.createPriority.value,
    assignee: elements.createAssignee.value,
  };

  try {
    const { ticket } = await api.createTicket(payload);

    toast(`Заявка №${ticket.id} создана`);
    elements.createForm.reset();
    updatePriorityHint(elements.createPriority, elements.createPriorityHint);

    await refresh();
  } catch (error) {
    elements.createError.textContent = error.message;
    elements.createError.hidden = false;
  } finally {
    elements.createSubmit.disabled = false;
  }
}

function openEditDialog(ticket) {
  state.editing = ticket;

  elements.editTitle.textContent = `Заявка №${ticket.id}`;
  elements.editSubtitle.textContent = `Текущий статус: ${ticket.status}. Статус меняется кнопками в карточке.`;
  elements.editTitleInput.value = ticket.title;
  elements.editDescription.value = ticket.description;
  elements.editPriority.value = ticket.priority;
  elements.editAssignee.value = ticket.assignee;
  elements.editError.hidden = true;

  updatePriorityHint(elements.editPriority, elements.editPriorityHint);

  elements.editDialog.showModal();
  elements.editTitleInput.focus();
}

async function onEditSubmit(event) {
  event.preventDefault();

  if (!state.editing) {
    return;
  }

  elements.editError.hidden = true;

  try {
    await api.updateTicket(state.editing.id, {
      title: elements.editTitleInput.value,
      description: elements.editDescription.value,
      priority: elements.editPriority.value,
      assignee: elements.editAssignee.value,
    });

    elements.editDialog.close();
    toast(`Заявка №${state.editing.id} сохранена`);

    await refresh();
  } catch (error) {
    elements.editError.textContent = error.message;
    elements.editError.hidden = false;
  }
}

/* ------------------------------------------------------------------ */
/* Справочники и фильтры                                               */
/* ------------------------------------------------------------------ */

/** Заполняет выпадающий список вариантами. */
function fillSelect(select, values, { keepFirst = true, label = null } = {}) {
  const current = select.value;

  select.replaceChildren();

  if (keepFirst) {
    const option = el('option', null, label ?? 'Не выбрано');
    option.value = '';
    select.append(option);
  }

  for (const value of values) {
    const option = el('option', null, value);
    option.value = value;
    select.append(option);
  }

  if (current && values.includes(current)) {
    select.value = current;
  }
}

/** Подсказывает срок обработки для выбранного приоритета. */
function updatePriorityHint(select, hint) {
  const hours = state.meta?.slaHours?.[select.value];

  hint.textContent = hours ? `Срок обработки: ${hours} ч` : 'Выберите приоритет — станет ясен срок обработки';
}

async function loadMeta() {
  state.meta = await api.meta();

  fillSelect(elements.filterStatus, state.meta.statuses, { label: 'Все статусы' });
  fillSelect(elements.filterPriority, state.meta.priorities, { label: 'Все приоритеты' });
  fillSelect(elements.createPriority, state.meta.priorities, { keepFirst: false });
  fillSelect(elements.editPriority, state.meta.priorities, { keepFirst: false });

  const assignees = [...new Set(state.tickets.map((ticket) => ticket.assignee).filter(Boolean))];

  if (assignees.length) {
    fillSelect(elements.filterAssignee, assignees, { label: 'Все исполнители' });
  }

  fillSelect(elements.createAssignee, assignees, { label: 'Не назначен' });
  fillSelect(elements.editAssignee, assignees, { label: 'Не назначен' });

  updatePriorityHint(elements.createPriority, elements.createPriorityHint);
  updatePriorityHint(elements.editPriority, elements.editPriorityHint);
}

/** Применяет фильтры и перезагружает список. */
function applyFilters() {
  state.filters.status = elements.filterStatus.value;
  state.filters.priority = elements.filterPriority.value;
  state.filters.assignee = elements.filterAssignee.value;
  state.filters.search = elements.filterSearch.value.trim();

  const [sortBy, sortOrder] = elements.filterSort.value.split(':');

  state.filters.sortBy = sortBy;
  state.filters.sortOrder = sortOrder;

  loadTickets();
}

function resetFilters() {
  elements.filterSearch.value = '';
  elements.filterStatus.value = '';
  elements.filterPriority.value = '';
  elements.filterAssignee.value = '';
  elements.filterSort.value = 'createdAt:desc';

  applyFilters();
}

/* ------------------------------------------------------------------ */
/* Запуск                                                              */
/* ------------------------------------------------------------------ */

async function checkHealth() {
  try {
    await api.health();

    elements.serverState.dataset.state = 'ok';
    elements.serverStateText.textContent = 'сервер работает';
  } catch {
    elements.serverState.dataset.state = 'error';
    elements.serverStateText.textContent = 'сервер недоступен';
  }
}

function startClock() {
  const tick = () => {
    elements.clock.textContent = new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  tick();
  setInterval(tick, 30_000);
}

function bindEvents() {
  elements.createForm.addEventListener('submit', onCreate);
  elements.editForm.addEventListener('submit', onEditSubmit);

  elements.editCancel.addEventListener('click', () => elements.editDialog.close());

  elements.createPriority.addEventListener('change', () =>
    updatePriorityHint(elements.createPriority, elements.createPriorityHint),
  );

  elements.editPriority.addEventListener('change', () =>
    updatePriorityHint(elements.editPriority, elements.editPriorityHint),
  );

  elements.filterStatus.addEventListener('change', applyFilters);
  elements.filterPriority.addEventListener('change', applyFilters);
  elements.filterAssignee.addEventListener('change', applyFilters);
  elements.filterSort.addEventListener('change', applyFilters);
  elements.filterReset.addEventListener('click', resetFilters);

  let searchTimer = null;

  elements.filterSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 280);
  });
}

async function start() {
  bindEvents();
  startClock();

  await checkHealth();

  try {
    await loadMeta();
    await refresh();
  } catch (error) {
    elements.boardBody.replaceChildren(
      el('p', 'empty', `Сервер недоступен: ${error.message}. Запустите его командой npm start.`),
    );
    toast(error.message, 'error');
  }

  // Сводка и список подновляются, чтобы просрочки и счётчики не устаревали.
  setInterval(loadStats, 60_000);
}

start();
