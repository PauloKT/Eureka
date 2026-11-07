import { THEMES } from './research.mjs';

export const REVIEW_STATUS = Object.freeze(['peer_reviewed', 'preprint', 'institutional_release', 'unknown']);
export const EMPTY_REASON = Object.freeze(['no_eligible_evidence', 'sources_unavailable_or_incomplete', null]);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const DiscoverySearchResponse = { parse(value) {
  if (!value || !uuid(value.selectionSetId) || Number.isNaN(Date.parse(value.expiresAt)) || typeof value.partial !== 'boolean' || !EMPTY_REASON.includes(value.emptyReason) || !Array.isArray(value.options) || value.options.length > 3) throw new Error('DISCOVERY_SEARCH_RESPONSE_INVALID');
  const ids = new Set();
  for (const item of value.options) {
    if (!uuid(item.id) || ids.has(item.id) || !THEMES.includes(item.themeId) || !REVIEW_STATUS.includes(item.reviewStatus) || typeof item.alreadyHeard !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt) || !Array.isArray(item.sources) || !item.sources.length) throw new Error('DISCOVERY_OPTION_INVALID');
    ids.add(item.id);
  }
  return value;
} };
