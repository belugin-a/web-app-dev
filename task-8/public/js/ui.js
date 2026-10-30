const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function initials(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function shortId(id) {
  return String(id ?? '').slice(0, 8);
}

export function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function avatarHtml(user, size = 'md') {
  const className = `avatar avatar--${size}`;

  if (user?.avatar) {
    return `<img class="${className}" src="/uploads/${encodeURIComponent(user.avatar)}" alt="" />`;
  }

  return `<span class="${className}" aria-hidden="true">${escapeHtml(initials(user?.name) || '?')}</span>`;
}

/** Всплывающее уведомление. Живёт 3 секунды и не блокирует интерфейс. */
export function toast(message, type = 'success') {
  const container = document.getElementById('toasts');
  if (!container) return;

  const element = document.createElement('div');
  element.className = `toast toast--${type}`;
  element.textContent = message;
  container.append(element);

  setTimeout(() => element.remove(), 3200);
}

export function showFormError(form, message) {
  const box = form.querySelector('.form__error');
  if (!box) return;

  box.textContent = message;
  box.hidden = false;
}

export function clearFormError(form) {
  const box = form.querySelector('.form__error');
  if (!box) return;

  box.textContent = '';
  box.hidden = true;
}

export function setFormBusy(form, busy) {
  form.setAttribute('aria-busy', String(busy));

  for (const element of form.elements) {
    element.disabled = busy;
  }

  const submit = form.querySelector('[type="submit"]');
  if (!submit) return;

  if (busy) {
    submit.dataset.label ??= submit.textContent;
    submit.textContent = 'Отправка…';
  } else if (submit.dataset.label) {
    submit.textContent = submit.dataset.label;
  }
}
