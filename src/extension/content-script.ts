import { createContentRecognizer, type RecognitionRequest } from './message-bridge';
import { YouTubeContentRuntime } from '../youtube/content-runtime';

declare const chrome: {
  runtime: {
    sendMessage(message: RecognitionRequest): Promise<unknown>;
  };
};

const recognize = createContentRecognizer((message) => chrome.runtime.sendMessage(message));

const runtime = new YouTubeContentRuntime({ recognize });
runtime.start();
