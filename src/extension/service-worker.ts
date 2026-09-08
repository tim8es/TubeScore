import {
  registerRecognitionMessageBridge,
  type RuntimeMessageApi
} from './message-bridge';

declare const chrome: {
  runtime: RuntimeMessageApi;
};

// The service worker owns recognition/network orchestration. Provider credentials
// are intentionally not embedded in the extension bundle; until runtime provider
// configuration is introduced, recognition safely returns no result.
registerRecognitionMessageBridge(chrome.runtime, async () => null);
