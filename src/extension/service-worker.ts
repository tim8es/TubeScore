import {
  registerRecognitionMessageBridge,
  type RuntimeMessageApi
} from './message-bridge';
import {
  createRecognitionOrchestrator,
  type RuntimeConfigStorage
} from './recognition-orchestrator';

declare const chrome: {
  runtime: RuntimeMessageApi;
  storage: {
    local: RuntimeConfigStorage;
  };
};

const recognize = createRecognitionOrchestrator({
  storage: chrome.storage.local
});

registerRecognitionMessageBridge(chrome.runtime, recognize);
