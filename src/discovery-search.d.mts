import type { z } from 'zod';
import type { DiscoverySearchResponse, ReviewedDiscovery } from '../packages/contracts/src/index';
export interface ResearchStore {
  getCompletedStudyKeys(userId: string, themeId: string): Promise<string[]>;
  getEvidenceDiscovery(identifier: string, themeId: string): Promise<z.infer<typeof ReviewedDiscovery> | null>;
  saveEvidenceDiscovery(identifier: string, themeId: string, value: unknown): Promise<void>;
  saveSelection(userId: string, input: unknown): Promise<{id: string; expires_at: string}>;
}
export function discoverySearch(args: {
  userId: string; themeId: string; providers: Record<string, (query: string, options: {limit: number}) => Promise<unknown[]>>;
  store: ResearchStore; cache?: {get(key: string): Promise<unknown>; set(key: string, value: {cachedUntil: string}): Promise<void>};
  now?: Date; recencyDays?: number;
  prepareDiscoveries?: (records: any[], context: {themeId:string;userId:string}) => Promise<z.infer<typeof ReviewedDiscovery>[]>;
}): Promise<z.infer<typeof DiscoverySearchResponse>>;
