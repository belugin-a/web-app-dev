import { JSON_SOURCE, loadFlightsFromJson } from './json-view.js';
import { initLiveUpdates, initSseFeed, requestSnapshot } from './live.js';
import { escapeHtml } from './store.js';

const loadButton = document.querySelector('#load-data');
const loadStatus = document.querySelector('#load-status');
const flightsContainer = document.querySelector('#flights');

initLiveUpdates();
initSseFeed();

loadButton.addEventListener('click', async () => {
  const buttonText = loadButton.textContent;

  loadButton.disabled = true;
  loadButton.textContent = 'Загрузка…';
  loadStatus.textContent = '';
  loadStatus.classList.remove('load-status--error');

  try {
    await loadFlightsFromJson();
    loadStatus.textContent = `Данные из файла ${JSON_SOURCE} успешно загружены`;
    requestSnapshot();
  } catch (error) {
    loadStatus.textContent = `Не удалось загрузить ${JSON_SOURCE}: ${error.message}`;
    loadStatus.classList.add('load-status--error');
    flightsContainer.innerHTML = `
      <p class="message message--error">
        Не удалось загрузить данные: ${escapeHtml(error.message)}
      </p>
    `;
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = buttonText;
  }
});
