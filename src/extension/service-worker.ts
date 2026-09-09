import {
  registerRecognitionMessageBridge,
  type RuntimeMessageApi
} from './message-bridge';
import { createPublicRecognitionOrchestrator } from './public-recognition-orchestrator';

declare const chrome: {
  runtime: RuntimeMessageApi;
};

const recognize = createPublicRecognitionOrchestrator();
registerRecognitionMessageBridge(chrome.runtime, recognize);
