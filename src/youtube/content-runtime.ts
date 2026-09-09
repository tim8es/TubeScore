import type { RecognitionResult, YouTubeVideoContext } from '../core/types';
import { renderRatingCard, renderUnavailableCard } from '../ui/rating-card';
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
  private metadataObserver: MutationObserver | null = null;
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
    this.armMetadataObserver();
    this.scheduleRecognition();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.generation += 1;
    this.window.removeEventListener('yt-navigate-finish', this.handleNavigation);
    this.window.removeEventListener('popstate', this.handleNavigation);
    this.disarmMetadataObserver();
    this.removeCard();
  }

  whenIdle(): Promise<void> {
    return this.currentTask;
  }

  private readonly handleNavigation = (): void => {
    this.armMetadataObserver();
    this.scheduleRecognition();
  };

  private armMetadataObserver(): void {
    this.disarmMetadataObserver();

    const root = this.document.documentElement;
    if (!root) return;

    const Observer = this.document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (!Observer) return;

    const observer = new Observer(() => {
      if (!this.started) return;
      this.scheduleRecognition();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
    this.metadataObserver = observer;
  }

  private disarmMetadataObserver(): void {
    this.metadataObserver?.disconnect();
    this.metadataObserver = null;
  }

  private scheduleRecognition(): void {
    const context = extractYouTubeVideoContext(this.document, this.window.location);
    if (!context) {
      if (this.window.location.pathname === '/watch') {
        const urlVideoId = new URLSearchParams(this.window.location.search).get('v')?.trim() ?? null;
        if (urlVideoId && urlVideoId === this.lastVideoId) {
          return;
        }
        if (urlVideoId !== this.lastVideoId) {
          this.lastVideoId = null;
        }
      } else {
        this.lastVideoId = null;
        this.disarmMetadataObserver();
      }

      this.generation += 1;
      this.removeCard();
      this.currentTask = Promise.resolve();
      return;
    }

    this.disarmMetadataObserver();

    if (context.videoId === this.lastVideoId) {
      return;
    }

    const runId = ++this.generation;
    this.removeCard();
    this.lastVideoId = context.videoId;
    this.currentTask = this.recognize(context)
      .then((result) => {
        if (!this.isCurrentRequest(runId, context.videoId) || !result) return;

        const card = renderRatingCard(result);
        if (card.hidden) return;
        this.mountCard(card);
      })
      .catch(() => {
        if (!this.isCurrentRequest(runId, context.videoId)) return;
        this.mountCard(renderUnavailableCard());
      });
  }

  private isCurrentRequest(runId: number, videoId: string): boolean {
    if (!this.started || runId !== this.generation) return false;
    if (this.window.location.pathname !== '/watch') return false;
    const currentVideoId = new URLSearchParams(this.window.location.search).get('v')?.trim();
    return currentVideoId === videoId;
  }

  private mountCard(card: HTMLElement): void {
    const mount = this.document.querySelector('#above-the-fold, #meta') ?? this.document.body;
    mount.append(card);
  }

  private removeCard(): void {
    for (const card of Array.from(this.document.querySelectorAll('.tubescore-card'))) {
      card.remove();
    }
  }
}
