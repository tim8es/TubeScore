import type { CatalogCandidate } from '../core/types';

export interface CatalogProvider {
  search(query: string): Promise<CatalogCandidate[]>;
}
