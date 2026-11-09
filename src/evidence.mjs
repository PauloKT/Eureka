const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export async function createEvidencePackage(record, { excerpts, capturedAt = new Date().toISOString(), access = record.access } = {}) {
  if (!record.title || !record.url || !record.publishedAt || !record.identifier) throw new Error('EVIDENCE_SOURCE_INCOMPLETE');
  if (!Array.isArray(excerpts) || excerpts.length < 1 || excerpts.length > 20) throw new Error('EVIDENCE_EXCERPTS_INVALID');
  const sourceId = crypto.randomUUID();
  const normalized = excerpts.map((entry, i) => {
    const text = typeof entry === 'string' ? entry.trim() : String(entry.text || '').trim();
    if (!text || text.length > 4000 || !record.abstract?.includes(text)) throw new Error('EXCERPT_NOT_VERIFIABLE_IN_RETRIEVED_TEXT');
    return { id: String(entry.id || `abstract-${i + 1}`).slice(0, 100), text };
  });
  const contentHash = await digest(record.abstract);
  const source = { id: sourceId, title: record.title, url: record.url, publisher: record.publisher, publishedAt: record.publishedAt, contentHash, excerpts: normalized };
  const packageMetadata = { id: crypto.randomUUID(), provider: record.provider, identifier: record.identifier, authors: record.authors, editorialStatus: record.editorialStatus, publicationDate: record.publishedAt, updatedAt: record.updatedAt, access, capturedAt, contentHash: source.contentHash, sourceId, retainedContent: 'selected abstract excerpts only' };
  return { packageMetadata, source };
}

export function supportedText(text, refs, packageData) {
  if (!text?.trim() || !Array.isArray(refs) || refs.length < 1) throw new Error('EVIDENCE_REFERENCE_REQUIRED');
  for (const ref of refs) {
    const source = packageData.source;
    if (ref.sourceId !== source.id || !source.excerpts.some(x => x.id === ref.excerptId)) throw new Error('EVIDENCE_REFERENCE_NOT_FOUND');
  }
  return { text: text.trim(), references: refs };
}

export function buildDiscovery({ themeId, title, summary, record, packageData, result, evidence, limitation, reviewedByHuman = false }) {
  if (!reviewedByHuman) throw new Error('HUMAN_EVIDENCE_REVIEW_REQUIRED');
  const evidenceCard = {
    result: supportedText(result.text, result.references, packageData),
    evidence: supportedText(evidence.text, evidence.references, packageData),
    limitation: supportedText(limitation.text, limitation.references, packageData),
  };
  return { id: crypto.randomUUID(), themeId, title: title.trim(), summary: summary.trim(), publishedAt: record.publishedAt, studyKey: record.identifier, topicKey: record.identifier, eligible: true, evidencePackageId: packageData.packageMetadata.id, evidenceCard, sources: [packageData.source] };
}

export function auditScriptReferences(script, sourceRecords) {
  const issues = [];
  const refs = [...script.claims.flatMap(x => x.references), ...Object.values(script.evidenceCard).flatMap(x => x.references)];
  for (const ref of refs) {
    const source = sourceRecords.find(x => x.id === ref.sourceId);
    if (!source || !source.excerpts.some(x => x.id === ref.excerptId)) issues.push(`unknown_reference:${ref.sourceId}:${ref.excerptId}`);
  }
  for (const claim of script.claims) if (!claim.text?.trim()) issues.push(`empty_claim:${claim.id}`);
  return { supported: issues.length === 0, checkedClaimIds: script.claims.map(x => x.id), issues };
}
