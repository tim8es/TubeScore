import type { RecognitionResult, YouTubeVideoContext } from '../core/types';
import { renderRatingCard } from '../ui/rating-card';
import { extractYouTubeVideoContext } from './metadata';

export interface YouTubeContentRuntimeOptions {
  recognize(context: YouTubeVideoContext): Promise<RecognitionResult | null>;
  document?: Document;
  window?: Window;
}

export class YouTubeContentRuntime {
  private readonly recognize: YouTubeContentRuntimeOptions['recognize'];
  private readonly document: Document;
  private readonly window: Window;
  private generation = 0;
  private lastVideoId: string | null = null;
  private currentTask: Promise<void> = Promise.resolve();
  private started = false;

  constructor(options: YouTubeContentRuntimeOptions) {
    this.recognize = options.recognize;
    this.document = options.document ?? document;
    this.window = options.window ?? window;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.window.addEventListener('yt-navigate-finish', this.handleNavigation);
    this.window.addEventListener('popstate', this.handleNavigation);
    this.scheduleRecognition();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.generation += 1;
    this.window.removeEventListener('yt-navigate-finish', this.handleNavigation);
    this.window.removeEventListener('popstate', this.handleNavigation);
    this.removeCard();
  }

  whenIdle(): Promise<void> {
    return this.currentTask;
  }

  private readonly handleNavigation = (): void => {
    this.scheduleRecognition();
  };

  private scheduleRecognition(): void {
    const runId = ++this.generation;
    this.removeCard();

    const context = extractYouTubeVideoContext(this.document, this.window.location);
    if (!context) {
      this.lastVideoId = null;
      this.currentTask = Promise.resolve();
      return;
    }

    if (context.videoId === this.lastVideoId) {
      this.currentTask = Promise.resolve();
      return;
    }

    this.lastVideoId = context.videoId;
    this.currentTask = this.recognize(context)
      .then((result) => {
        if (!this.started || runId !== this.generation || !result) return;

        const current = extractYouTubeVideoContext(this.document, this.window.location);
        if (!current || current.videoId !== context.videoId) return;

        const card = renderRatingCard(result);
        if (card.hidden) return;

        const mount = this.document.querySelector('#above-the-fold, #meta') ?? this.document.body;
        mount.append(card);
      })
      .catch(() => {
        // Recognition failures are non-fatal for the host YouTube page.
      });
  }

  private removeCard(): void {
    for (const card of Array.from(this.document.querySelectorAll('.tubescore-card'))) {
      card.remove();
    }
  }
}
