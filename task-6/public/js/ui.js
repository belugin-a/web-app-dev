export function setActionStatus(text, { error = false } = {}) {
  const element = document.querySelector('#action-status');

  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.toggle('action-status--error', error);
}
