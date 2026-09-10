export type MediaType = 'movie' | 'tv';

export interface YouTubeVideoContext {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  hashtags: string[];
  url: string;
}

export interface CatalogCandidate {
  providerId: string;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseYear?: number;
}

export interface MatchScore {
  candidate: CatalogCandidate;
  confidence: number;
  reasons: string[];
}

export type MatchState = 'high' | 'likely' | 'hidden';

export interface MatchDecision {
  state: MatchState;
  score: MatchScore;
}

export interface RatingValue {
  source: string;
  value: number;
  scale: number;
  voteCount?: number;
  url?: string;
}

export interface RecognitionResult {
  decision: MatchDecision;
  ratings: RatingValue[];
}

export interface RecognitionOptions {
  enabledSources?: readonly string[];
}
