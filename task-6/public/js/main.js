import { initJsonOperations, JSON_SOURCE, loadFlightsFromJson } from './json-view.js';
import { initLiveUpdates, initSseFeed, requestSnapshot } from './live.js';
import { escapeHtml, state } from './store.js';
import { XML_SOURCE, initXmlOperations, loadFlightsFromXml } from './xml-view.js';

const loadButton = document.querySelector('#load-data');
const loadStatus = document.querySelector('#load-status');
const xmlButton = document.querySelector('#load-xml');
const xmlStatus = document.querySelector('#xml-status');
const flightsContainer = document.querySelector('#flights');

initLiveUpdates();
initSseFeed();
initJsonOperations();
initXmlOperations();

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

xmlButton.addEventListener('click', async () => {
  const buttonText = xmlButton.textContent;

  xmlButton.disabled = true;
  xmlButton.textContent = 'Загрузка…';
  xmlStatus.textContent = '';
  xmlStatus.classList.remove('load-status--error');

  try {
    const count = await loadFlightsFromXml();
    const suffix = state.loaded
      ? 'колонки «Терминал» и «Регистрация» добавлены в таблицу'
      : 'колонки появятся в таблице после загрузки JSON';

    xmlStatus.textContent = `Данные из файла ${XML_SOURCE} успешно загружены: записей — ${count}, ${suffix}`;
  } catch (error) {
    xmlStatus.textContent = `Не удалось загрузить ${XML_SOURCE}: ${error.message}`;
    xmlStatus.classList.add('load-status--error');
  } finally {
    xmlButton.disabled = false;
    xmlButton.textContent = buttonText;
  }
});
