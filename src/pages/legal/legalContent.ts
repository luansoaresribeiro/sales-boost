// Conteúdo jurídico do SalesBoost — Política de Privacidade (LGPD) e Termos de
// Uso. Estrutura pronta pra produção. TROQUE OS PLACEHOLDERS ABAIXO pelos dados
// reais da empresa (um lugar só) antes de considerar oficial. Nada de design é
// afetado — isto é só texto consumido pelas páginas legais.

export const LEGAL_COMPANY = {
  name: '68.292.967 LUAN SOARES RIBEIRO',
  brand: 'SalesBoost',
  cnpj: '68.292.967/0001-28',
  address: '[Rua/Av., nº, Bairro, Cidade/UF, CEP]',
  email: 'contato@getsaleboost.com',
  privacyEmail: 'privacidade@getsaleboost.com',
  site: 'getsaleboost.com',
  jurisdiction: '[Comarca de Cidade/UF]',
  updated: '22/08/2026',
}

export interface LegalSection { heading: string; paragraphs?: string[]; bullets?: string[] }
export interface LegalDoc { title: string; subtitle: string; sections: LegalSection[] }

const C = LEGAL_COMPANY

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Política de Privacidade',
  subtitle: `Como o ${C.brand} trata seus dados pessoais, em conformidade com a Lei nº 13.709/2018 (LGPD).`,
  sections: [
    {
      heading: '1. Quem é o controlador dos dados',
      paragraphs: [
        `O ${C.brand} é operado por ${C.name}, inscrita no CNPJ sob nº ${C.cnpj}, com sede em ${C.address} ("nós", "nossa" ou "plataforma"). Somos o controlador dos dados pessoais tratados por meio da plataforma, nos termos da LGPD.`,
        `Para qualquer assunto relacionado a privacidade e proteção de dados, entre em contato pelo e-mail ${C.privacyEmail}.`,
      ],
    },
    {
      heading: '2. Quais dados coletamos',
      paragraphs: ['Coletamos apenas os dados necessários para operar a plataforma e gerar valor para o seu negócio:'],
      bullets: [
        `Página pública de um imóvel: quando um visitante abre o link de um imóvel e envia o formulário, coletamos o nome, o contato (WhatsApp ou e-mail) e a mensagem que ele digitar, mais o aviso de que concordou em enviá-los. A finalidade é uma só: a imobiliária responder à pessoa sobre aquele imóvel — a imobiliária é a controladora desses dados e o ${C.brand} atua como operador, guardando-os no painel dela. Não enviamos nada à pessoa automaticamente, não usamos esses dados para publicidade e não guardamos o endereço IP do visitante (só um código irreversível, para contar visitas e evitar abuso). Para pedir a exclusão, escreva para ${C.privacyEmail} ou para a própria imobiliária.`,
        'Dados de cadastro: nome, e-mail, senha (armazenada de forma criptografada) e dados da empresa (nome, tipo de negócio, cidade, site, redes sociais).',
        'Dados de uso e conteúdo do negócio: posts, campanhas, avaliações, oportunidades, leads, mensagens com os agentes de IA e configurações.',
        'Dados públicos coletados de fontes externas que você conecta (ex.: avaliações do Google, perfis e publicações públicas em redes sociais, informações do Google Maps).',
        'Dados técnicos: endereço IP, tipo de navegador e dispositivo, e informações de navegação coletadas por cookies (ver seção de Cookies).',
        'Dados de pagamento: processados diretamente pelo nosso provedor de pagamentos (Stripe). Não armazenamos os dados completos do seu cartão em nossos servidores.',
      ],
    },
    {
      heading: '3. Para que usamos seus dados (finalidades)',
      bullets: [
        'Criar e gerenciar sua conta e autenticá-lo com segurança.',
        'Prestar os serviços da plataforma: gerar conteúdo, analisar avaliações, monitorar concorrentes, produzir diagnósticos e recomendações.',
        'Processar assinaturas e pagamentos.',
        'Enviar notificações e comunicações sobre a operação dos agentes (quando você autoriza).',
        'Melhorar a plataforma, prevenir fraudes e garantir a segurança.',
        'Cumprir obrigações legais e regulatórias.',
      ],
    },
    {
      heading: '4. Bases legais (art. 7º da LGPD)',
      paragraphs: ['Tratamos seus dados com fundamento em: (i) execução de contrato, para prestar os serviços que você contratou; (ii) consentimento, quando aplicável (ex.: cookies não essenciais e certas comunicações); (iii) legítimo interesse, para melhorar e proteger a plataforma, sempre respeitando seus direitos; e (iv) cumprimento de obrigação legal ou regulatória.'],
    },
    {
      heading: '5. Inteligência Artificial e conteúdo gerado',
      paragraphs: [
        `O ${C.brand} usa modelos de IA para gerar rascunhos de conteúdo, análises e recomendações. Esses dados são enviados a provedores de IA apenas para processar a sua solicitação.`,
        'Princípio do controle humano: nada é publicado ou enviado a terceiros automaticamente — todo conteúdo gerado permanece como rascunho até a sua aprovação explícita, salvo quando você mesmo ativar uma automação específica.',
      ],
    },
    {
      heading: '6. Compartilhamento e operadores',
      paragraphs: ['Não vendemos seus dados pessoais. Compartilhamos dados apenas com prestadores que nos ajudam a operar a plataforma (operadores), obrigados contratualmente a protegê-los, tais como:'],
      bullets: [
        'Infraestrutura e banco de dados (Supabase, Cloudflare).',
        'Modelos de inteligência artificial (Anthropic).',
        'Coleta de dados públicos (Apify) e diagnósticos de site (Google PageSpeed).',
        'Pagamentos (Stripe).',
        'E-mail transacional (Resend) e voz (ElevenLabs).',
        'Integrações que você conecta (ex.: Meta/Instagram, Google Business Profile).',
      ],
    },
    {
      heading: '7. Transferência internacional',
      paragraphs: ['Alguns operadores podem processar dados fora do Brasil. Nesses casos, adotamos salvaguardas adequadas para garantir um nível de proteção compatível com a LGPD.'],
    },
    {
      heading: '8. Seus direitos como titular (art. 18 da LGPD)',
      paragraphs: ['Você pode, a qualquer momento, solicitar:'],
      bullets: [
        'Confirmação da existência de tratamento e acesso aos seus dados.',
        'Correção de dados incompletos, inexatos ou desatualizados.',
        'Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.',
        'Portabilidade dos dados a outro fornecedor, mediante requisição.',
        'Eliminação dos dados tratados com base no consentimento.',
        'Informação sobre com quem compartilhamos seus dados.',
        'Revogação do consentimento.',
      ],
    },
    {
      heading: '9. Retenção e eliminação',
      paragraphs: [`Mantemos seus dados enquanto sua conta estiver ativa e pelo prazo necessário para cumprir as finalidades descritas e obrigações legais. Encerrada a conta, os dados são eliminados ou anonimizados, salvo quando a lei exigir guarda por prazo específico. Para solicitar a exclusão, escreva para ${C.privacyEmail}.`],
    },
    {
      heading: '10. Segurança',
      paragraphs: ['Adotamos medidas técnicas e organizacionais para proteger seus dados, como criptografia, controle de acesso e isolamento por empresa (multi-tenant). Nenhum sistema é 100% infalível, mas trabalhamos continuamente para reduzir riscos.'],
    },
    {
      heading: '11. Cookies',
      paragraphs: ['Usamos cookies essenciais (necessários para o funcionamento e a autenticação) e, mediante seu consentimento, cookies de análise para entender o uso da plataforma. Você pode gerenciar sua preferência pelo banner de cookies exibido na primeira visita e a qualquer momento nas configurações do seu navegador.'],
    },
    {
      heading: '12. Crianças e adolescentes',
      paragraphs: ['A plataforma é destinada a titulares de negócios maiores de 18 anos. Não coletamos intencionalmente dados de menores.'],
    },
    {
      heading: '13. Alterações desta política',
      paragraphs: ['Podemos atualizar esta Política periodicamente. Alterações relevantes serão comunicadas pelos canais da plataforma. A data da última atualização consta no topo deste documento.'],
    },
    {
      heading: '14. Encarregado (DPO) e contato',
      paragraphs: [`Dúvidas, solicitações ou reclamações sobre privacidade podem ser enviadas para ${C.privacyEmail}. Você também pode contatar a Autoridade Nacional de Proteção de Dados (ANPD).`],
    },
  ],
}

export const TERMS_OF_USE: LegalDoc = {
  title: 'Termos de Uso',
  subtitle: `Condições para uso da plataforma ${C.brand}. Ao usar, você concorda com estes termos.`,
  sections: [
    {
      heading: '1. Aceitação dos termos',
      paragraphs: [`Estes Termos de Uso regem o acesso e o uso da plataforma ${C.brand}, operada por ${C.name} (CNPJ ${C.cnpj}). Ao criar uma conta ou usar a plataforma, você declara ter lido, entendido e concordado com estes termos e com a Política de Privacidade.`],
    },
    {
      heading: '2. Descrição do serviço',
      paragraphs: [`O ${C.brand} é uma plataforma de crescimento com inteligência artificial que ajuda pequenos e médios negócios a executar tarefas de marketing e vendas — geração de conteúdo, análise de avaliações, monitoramento de concorrentes, diagnóstico de site, gestão de oportunidades e atendimento. As funcionalidades podem evoluir com o tempo.`],
    },
    {
      heading: '3. Cadastro e responsabilidades do usuário',
      bullets: [
        'Você deve fornecer informações verdadeiras, completas e atualizadas.',
        'Você é responsável por manter a confidencialidade de suas credenciais e por todas as atividades realizadas na sua conta.',
        'Você deve ter ao menos 18 anos e capacidade legal para contratar.',
        'Você é o responsável final por revisar e aprovar qualquer conteúdo antes de publicá-lo ou enviá-lo a terceiros.',
      ],
    },
    {
      heading: '4. Assinaturas e pagamentos',
      bullets: [
        'O acesso a determinados recursos depende de assinatura paga, cobrada de forma recorrente conforme o plano escolhido.',
        'Os pagamentos são processados pelo provedor Stripe. Ao assinar, você autoriza a cobrança recorrente até o cancelamento.',
        'Você pode cancelar a assinatura a qualquer momento; o acesso permanece ativo até o fim do ciclo já pago.',
        'Salvo disposição legal em contrário ou indicação expressa nossa, valores já pagos não são reembolsados proporcionalmente.',
        'Preços e planos podem ser alterados, com aviso prévio razoável.',
      ],
    },
    {
      heading: '5. Conteúdo gerado por IA',
      bullets: [
        'A plataforma gera rascunhos e sugestões por meio de inteligência artificial. Esse conteúdo pode conter imprecisões e deve ser revisado por você antes de qualquer uso.',
        'Nada é publicado automaticamente: o conteúdo permanece como rascunho até sua aprovação, salvo automações que você ativar deliberadamente.',
        'Você é o único responsável pelo conteúdo que decidir aprovar, publicar ou enviar, inclusive por sua conformidade legal e veracidade.',
        'Não garantimos resultados específicos de marketing, vendas ou faturamento decorrentes do uso da plataforma.',
      ],
    },
    {
      heading: '6. Propriedade intelectual',
      paragraphs: [
        `A plataforma, sua marca, software, design e demais elementos são de titularidade de ${C.name} e protegidos por lei. Estes termos não transferem a você qualquer direito sobre a propriedade intelectual da plataforma, exceto a licença limitada de uso enquanto sua conta estiver ativa.`,
        'O conteúdo e os dados do seu negócio permanecem seus. Você nos concede apenas a licença necessária para operar os serviços em seu benefício.',
      ],
    },
    {
      heading: '7. Uso aceitável',
      paragraphs: ['Você concorda em não:'],
      bullets: [
        'Usar a plataforma para fins ilegais, fraudulentos ou que violem direitos de terceiros.',
        'Enviar spam, conteúdo enganoso, difamatório, discriminatório ou que viole políticas das redes e canais integrados.',
        'Tentar acessar áreas ou dados sem autorização, burlar limites, ou comprometer a segurança e a integridade do sistema.',
        'Copiar, revender ou explorar a plataforma sem autorização.',
      ],
    },
    {
      heading: '8. Integrações de terceiros',
      paragraphs: ['A plataforma pode se conectar a serviços de terceiros (ex.: Meta/Instagram, Google, WhatsApp). O uso dessas integrações está sujeito também aos termos e políticas desses terceiros. Não somos responsáveis por indisponibilidades ou alterações desses serviços.'],
    },
    {
      heading: '9. Isenções e limitação de responsabilidade',
      paragraphs: [
        'A plataforma é fornecida "no estado em que se encontra". Não garantimos disponibilidade ininterrupta nem ausência de erros.',
        'Na máxima extensão permitida em lei, nossa responsabilidade total por quaisquer perdas relacionadas ao uso da plataforma fica limitada ao valor pago por você nos 12 meses anteriores ao evento. Não respondemos por danos indiretos, lucros cessantes ou perda de dados decorrentes de fatores fora do nosso controle razoável.',
      ],
    },
    {
      heading: '10. Suspensão e encerramento',
      paragraphs: [`Podemos suspender ou encerrar contas que violem estes termos ou a lei. Você pode encerrar sua conta a qualquer momento. O encerramento não afeta obrigações já vencidas. Após o encerramento, tratamos seus dados conforme a Política de Privacidade.`],
    },
    {
      heading: '11. Alterações dos termos',
      paragraphs: ['Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas. O uso continuado após a atualização representa concordância com a nova versão.'],
    },
    {
      heading: '12. Lei aplicável e foro',
      paragraphs: [`Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da ${C.jurisdiction} para dirimir controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.`],
    },
    {
      heading: '13. Contato',
      paragraphs: [`Dúvidas sobre estes Termos podem ser enviadas para ${C.email}.`],
    },
  ],
}
