import { z } from 'zod';

export const ThemeId = z.enum(['space','health','brain','technology','nature','physics']);
const Text = z.string().trim().min(1).max(4000);
const Ref = z.object({ sourceId: z.string().uuid(), excerptId: z.string().min(1).max(100) }).strict();
const SupportedText = z.object({ text: Text, references: z.array(Ref).min(1).max(12) }).strict();
export const EvidenceCard = z.object({ result: SupportedText, evidence: SupportedText, limitation: SupportedText }).strict();
export const Source = z.object({
  id: z.string().uuid(), title: Text, url: z.string().url().refine(v => v.startsWith('https://')),
  publisher: Text, publishedAt: z.string().date(), contentHash: z.string().min(1),
  excerpts: z.array(z.object({ id: z.string().min(1).max(100), text: Text }).strict()).min(1).max(20),
}).strict();

// Produced and vetted by research/evidence modules (Person 2), never by mobile clients.
export const Discovery = z.object({
  id: z.string().uuid(), themeId: ThemeId, title: Text, summary: Text,
  publishedAt: z.string().date(), studyKey: Text, topicKey: Text,
  eligible: z.literal(true), evidencePackageId: z.string().uuid(),
  evidenceCard: EvidenceCard, sources: z.array(Source).min(1).max(8),
}).strict();
export const SelectionInput = z.object({
  themeId: ThemeId, options: z.array(Discovery).max(3),
}).strict().refine(v => v.options.every(d => d.themeId === v.themeId), 'Theme mismatch')
  .refine(v => new Set(v.options.map(d => d.id)).size === v.options.length, 'Duplicate discovery');
export const EpisodeChoice = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('chosen'), selectionSetId: z.string().uuid(), discoveryId: z.string().uuid() }).strict(),
  z.object({ mode: z.literal('surprise'), selectionSetId: z.string().uuid() }).strict(),
]);
export const ScriptCandidate = z.object({
  title: Text,
  paragraphs: z.array(z.object({ id: z.string().min(1), text: Text, claimIds: z.array(z.string().min(1)).min(1) }).strict()).min(1).max(12),
  claims: z.array(z.object({ id: z.string().min(1), text: Text, references: z.array(Ref).min(1).max(12) }).strict()).min(1).max(40),
  evidenceCard: EvidenceCard,
}).strict();
export const Audit = z.object({
  supported: z.boolean(),
  checkedClaimIds: z.array(z.string()),
  issues: z.array(z.string()).max(50),
}).strict();
export const ApprovedScript = ScriptCandidate.extend({
  auditStatus: z.literal('approved'), contentHash: z.string(), sourcePackageHash: z.string(),
  modelId: z.string(), promptVersion: z.literal('1'), createdAt: z.string(), language: z.literal('pt-BR'),
});
export type DiscoveryData = z.infer<typeof Discovery>;
export type ScriptData = z.infer<typeof ScriptCandidate>;
export type ApprovedScriptData = z.infer<typeof ApprovedScript>;
