// Exemplo mínimo do Higgsfield (Seedance 2.5, texto → vídeo).
// Roda só no servidor/terminal — a credencial nunca vai pro navegador.
//
//   node --env-file=.env.local --experimental-strip-types scripts/higgsfield/index.ts
//
// .env.local (fora do Git) precisa ter: HF_CREDENTIALS=key-id:key-secret
// ATENÇÃO: cada execução é uma geração cobrada (ver CLAUDE.md, teto de custo).
import { createHiggsfieldClient } from '@higgsfield/client/v2'

const MODEL = 'bytedance/seedance-2.5/text-to-video'

async function main(): Promise<number> {
  if (!process.env.HF_CREDENTIALS) {
    console.error('Falta HF_CREDENTIALS no .env.local (formato key-id:key-secret).')
    return 1
  }

  // O SDK lê HF_CREDENTIALS do ambiente; o valor nunca é impresso.
  const client = createHiggsfieldClient({ maxPollTime: 15 * 60 * 1000 })

  const jobSet = await client.subscribe(MODEL, {
    input: {
      prompt: 'A cinematic scene at sunset',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
    },
    withPolling: true,
  })

  if (jobSet.isNsfw) {
    console.error(`Recusado pela moderação (request ${jobSet.id}). Créditos devolvidos pela Higgsfield.`)
    return 1
  }
  if (jobSet.isFailed) {
    console.error(`Geração falhou (request ${jobSet.id}).`)
    return 1
  }
  if (jobSet.isCanceled) {
    console.error(`Geração cancelada (request ${jobSet.id}).`)
    return 1
  }
  if (!jobSet.isCompleted) {
    console.error(`Geração não terminou a tempo (request ${jobSet.id}); confira o status depois.`)
    return 1
  }

  const url = jobSet.jobs[0]?.results?.raw?.url
  if (!url) {
    console.error(`Concluída, mas sem URL de vídeo na resposta (request ${jobSet.id}).`)
    return 1
  }
  console.log('Vídeo gerado:', url)
  return 0
}

main().then(
  code => process.exit(code),
  (err: unknown) => {
    // Só a mensagem — nunca o objeto inteiro, que pode carregar headers.
    console.error('Erro ao chamar a Higgsfield:', err instanceof Error ? err.message : 'desconhecido')
    process.exit(1)
  },
)
