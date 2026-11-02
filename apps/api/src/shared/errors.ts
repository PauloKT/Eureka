export class AppError extends Error {
  constructor(public code: string, public status: 400 | 404 | 409 | 422 | 429 | 503 = 503) { super(code); }
}
export const errors: Record<string, { status: 400 | 404 | 409 | 422 | 429 | 503; message: string }> = {
  RETRY_LIMIT_REACHED: { status: 409, message: 'A tentativa corretiva já foi utilizada. Escolha outra descoberta.' },
  INVALID_INPUT: { status: 400, message: 'Confira os dados enviados.' },
  NOT_FOUND: { status: 404, message: 'Recurso não encontrado.' },
  SELECTION_EXPIRED: { status: 409, message: 'A seleção expirou. Faça uma nova busca.' },
  IDEMPOTENCY_CONFLICT: { status: 409, message: 'Esta tentativa já foi usada com outra escolha.' },
  OPERATION_IN_PROGRESS: { status: 409, message: 'Esta etapa já está em andamento.' },
  INVALID_STATE: { status: 409, message: 'A etapa anterior ainda não foi concluída.' },
  INSUFFICIENT_EVIDENCE: { status: 422, message: 'As evidências disponíveis não são suficientes.' },
  SCRIPT_REJECTED: { status: 422, message: 'O roteiro não passou pela revisão de evidências.' },
  AUDIO_DURATION_INVALID: { status: 422, message: 'O áudio não atende ao limite de duração.' },
  QUOTA_EXHAUSTED: { status: 429, message: 'O limite de geração foi atingido ou ainda não foi configurado.' },
  GENERATION_DISABLED: { status: 503, message: 'A geração ainda não está habilitada.' },
  PROVIDER_OUTCOME_UNKNOWN: { status: 503, message: 'Não foi possível confirmar a geração. A tentativa foi preservada para verificação.' },
  PROVIDER_UNAVAILABLE: { status: 503, message: 'O serviço de geração está indisponível.' },
  STORAGE_LIMIT_REACHED: { status: 503, message: 'O limite de armazenamento foi atingido.' },
  STORAGE_UNAVAILABLE: { status: 503, message: 'O armazenamento está temporariamente indisponível.' },
  AUDIO_EXPIRED: { status: 409, message: 'O prazo de acesso ao áudio terminou. O histórico foi preservado.' },
};
export function knownError(code: string) { return new AppError(code, errors[code]?.status ?? 503); }
