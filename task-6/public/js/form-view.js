import { resetJsonView } from './json-view.js';

export function initFlightForm() {
  const dialog = document.querySelector('#add-flight-dialog');
  const openButton = document.querySelector('#open-flight-dialog');
  const closeButton = document.querySelector('#close-flight-dialog');
  const cancelButton = document.querySelector('#cancel-flight-form');
  const form = document.querySelector('#flight-form');
  const statusElement = document.querySelector('#form-status');
  const panelStatus = document.querySelector('#flight-status');
  const submitButton = form.querySelector('button[type="submit"]');

  openButton.addEventListener('click', () => {
    statusElement.textContent = '';
    statusElement.classList.remove('form-status--error');
    panelStatus.textContent = '';
    dialog.showModal();
    form.elements.number.focus();
  });

  for (const button of [closeButton, cancelButton]) {
    button.addEventListener('click', () => dialog.close());
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    statusElement.textContent = 'Отправка…';
    statusElement.classList.remove('form-status--error');

    try {
      const payload = Object.fromEntries(new FormData(form));

      const response = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? `сервер вернул ${response.status}`);
      }

      resetJsonView();
      form.reset();
      dialog.close();
      panelStatus.textContent = `Рейс ${data.flight.number} добавлен и подсвечен в таблице`;
    } catch (error) {
      statusElement.textContent = `Не удалось добавить рейс: ${error.message}`;
      statusElement.classList.add('form-status--error');
    } finally {
      submitButton.disabled = false;
    }
  });
}
