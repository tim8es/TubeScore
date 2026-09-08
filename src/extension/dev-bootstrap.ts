import {
  clearLocalTmdbToken,
  saveLocalTmdbToken,
  type MutableRuntimeConfigStorage
} from './dev-config';
import { runBrowserSmokePreflight } from './smoke-preflight';

declare const chrome: {
  storage: {
    local: MutableRuntimeConfigStorage;
  };
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing_element:${id}`);
  return element as T;
}

const tokenInput = byId<HTMLInputElement>('tmdb-token');
const saveButton = byId<HTMLButtonElement>('save-token');
const clearButton = byId<HTMLButtonElement>('clear-token');
const preflightButton = byId<HTMLButtonElement>('run-preflight');
const status = byId<HTMLElement>('status');

async function renderPreflight(): Promise<void> {
  const verdict = await runBrowserSmokePreflight({ storage: chrome.storage.local });
  status.textContent = verdict.status;
}

saveButton.addEventListener('click', () => {
  void saveLocalTmdbToken(chrome.storage.local, tokenInput.value)
    .then(() => {
      tokenInput.value = '';
      return renderPreflight();
    })
    .catch(() => {
      status.textContent = 'invalid-config';
    });
});

clearButton.addEventListener('click', () => {
  void clearLocalTmdbToken(chrome.storage.local).then(renderPreflight);
});

preflightButton.addEventListener('click', () => {
  void renderPreflight();
});

void renderPreflight();
