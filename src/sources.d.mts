export interface SearchOptions { limit?: number; fetchImpl?: typeof fetch; now?: Date; recencyDays?: number }
export function searchEuropePmc(query: string, options?: SearchOptions): Promise<unknown[]>;
export function searchArxiv(query: string, options?: SearchOptions): Promise<unknown[]>;
export function searchOpenAlex(query: string, options?: SearchOptions): Promise<unknown[]>;
export function searchNasaNtrs(query: string, options?: SearchOptions): Promise<unknown[]>;
