import { initFlightForm } from './form-view.js';
import { initJsonOperations, loadFlightsFromJson } from './json-view.js';
import { initLiveUpdates, initSseFeed, requestSnapshot } from './live.js';
import { renderFlights } from './store.js';
import { setActionStatus } from './ui.js';
import { initXmlOperations, loadFlightsFromXml } from './xml-view.js';

const loadButton = document.querySelector('#load-data');
const loadXmlButton = document.querySelector('#load-xml');

initLiveUpdates();
initSseFeed();
initJsonOperations();
initXmlOperations();
initFlightForm();
renderFlights();

loadButton.addEventListener('click', async () => {
  loadButton.disabled = true;
  setActionStatus('');

  try {
    const count = await loadFlightsFromJson();
    setActionStatus(`JSON: ${count} рейсов загружено`);
    requestSnapshot();
  } catch (error) {
    setActionStatus(`JSON: ошибка — ${error.message}`, { error: true });
  } finally {
    loadButton.disabled = false;
  }
});

loadXmlButton.addEventListener('click', async () => {
  loadXmlButton.disabled = true;
  setActionStatus('');

  try {
    const count = await loadFlightsFromXml();
    setActionStatus(`XML: ${count} записей загружено`);
  } catch (error) {
    setActionStatus(`XML: ошибка — ${error.message}`, { error: true });
  } finally {
    loadXmlButton.disabled = false;
  }
});
