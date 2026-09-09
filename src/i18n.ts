export type Lang = 'pt' | 'en'

export const t = {
  pt: {
    nav: {
      features: 'Funcionalidades',
      how: 'Como funciona',
      pricing: 'Preços',
      cta: '3 dias grátis',
    },
    trialModal: {
      badge: 'Antes de começar',
      title: 'Seus 3 dias grátis começam agora',
      body: 'Teste tudo por 3 dias. Depois, é só um preço simples — e você só é cobrado se decidir continuar:',
      priceFrom: '',
      priceTo: 'R$ 14,49',
      priceNote: '/mês',
      cta: 'Começar meus 3 dias grátis →',
      dismiss: 'Fechar',
    },
    hero: {
      meta: [
        { label: 'Produto', value: 'Plataforma SaaS' },
        { label: 'Segmento', value: 'Qualquer negócio' },
        { label: 'Resultado em', value: '24 horas' },
      ],
      headline: ['A IA que cresce', 'o seu negócio.', 'Você só aprova.'],
      sub: 'Suas redes sociais, campanhas e atendimento num ciclo só: atrai, converte e vende — no piloto automático, sempre esperando o seu OK.',
      project: ['SalesBoost', 'Plataforma'],
      typeLabel: 'Modelo:',
      typeValue: 'Automatizado',
      sideLabels: ['Redes', 'Campanhas', 'Atendimento', 'Vendas'],
      bgWord: 'VENDAS',
      date: 'Jun 11',
      year: '2026',
      location: 'São Paulo, Brasil',
      reportTitle: 'Relatório Mensal',
      scoreLabel: 'Score de Saúde',
      reportItems: [
        { icon: '📲', text: 'Posts publicados' },
        { icon: '🎯', text: 'Campanha no ar' },
        { icon: '💬', text: 'Leads respondidos' },
      ],
      reportCta: 'Ver 3 Ações do Mês →',
    },
    stats: {
      badge: 'Resultados comprovados',
      intro: 'Somos a plataforma que junta redes sociais, campanhas e atendimento num ciclo só — transformando sua presença digital em mais vendas, no piloto automático e sempre com a sua aprovação.',
      items: [
        { value: '38%', label: 'Mais faturamento' },
        { value: '2.4×', label: 'Mais clientes atendidos' },
        { value: '24h', label: 'Primeiro resultado' },
      ],
    },
    features: {
      badge: '3 pilares que vendem',
      title1: 'Os 3',
      title2: 'Pilares',
      pillars: [
        {
          num: '01',
          title: 'Redes sociais',
          desc: 'Conteúdo e posts prontos pras suas redes toda semana — feitos pra aparecer pro cliente certo e trazer gente nova pro seu negócio.',
        },
        {
          num: '02',
          title: 'Campanhas',
          desc: 'Campanhas montadas em cima do que está em alta no seu segmento — pra transformar seguidor em cliente e movimentar as vendas.',
        },
        {
          num: '03',
          title: 'Atendimento',
          desc: 'Responde cada lead na hora e cuida da conversa até fechar a venda. Ninguém fica sem resposta, nenhuma venda fica pra trás.',
        },
      ],
    },
    how: {
      badge: 'O ciclo que traz dinheiro',
      title1: 'Como',
      title2: 'funciona',
      steps: [
        {
          num: '01',
          title: 'Conecte suas redes',
          desc: 'Ligue seu Instagram e Facebook em segundos. Toda a sua presença digital num lugar só.',
        },
        {
          num: '02',
          title: 'Conteúdo e campanhas prontos',
          desc: 'A plataforma cria posts e campanhas pro seu público — você só aprova o que vai ao ar.',
        },
        {
          num: '03',
          title: 'Atenda e venda mais',
          desc: 'Responda clientes na hora e feche vendas. O ciclo se repete e traz mais dinheiro todo mês.',
        },
      ],
    },
    showcase: {
      badge: 'Plataforma completa',
      title1: 'Tudo que você precisa,',
      title2: 'onde você estiver.',
      sub: 'Redes sociais, campanhas e atendimento trabalhando juntos — um ciclo que transforma sua presença digital em mais vendas, todo mês.',
      features: [
        'Posts prontos pras suas redes sociais',
        'Campanhas que trazem clientes novos',
        'Atendimento rápido a cada lead',
        'Dashboard com tudo num lugar só',
      ],
    },
    statement: {
      eyebrow: 'O produto',
      line1: 'Não é só presença.',
      line2: 'É presença que vende.',
      sub: 'Redes sociais, campanhas e atendimento num ciclo só — pra transformar seguidores em clientes e clientes em receita, mês após mês.',
      cta: 'Ver relatório demo',
    },
    pricing: {
      badge: 'Preços simples',
      title1: 'Planos para',
      title2: 'todo tamanho',
      popular: 'Mais popular',
      cta: 'Começar agora',
      regions: {
        br: {
          label: '🇧🇷 Brasil',
          plans: [
            {
              name: 'SalesBoost',
              price: 'R$14,49',
              period: '/mês',
              popular: true,
              features: ['Posts com imagem por IA', 'Campanhas de conteúdo', 'Revenue Opportunities', 'Atendimento automático a leads', 'Automação 24/7', 'Relatórios mensais em PDF', 'Diagnóstico de site', 'Suporte'],
            },
          ],
        },
        us: {
          label: '🇺🇸 USA',
          plans: [
            {
              name: 'SalesBoost',
              price: '$2.99',
              period: '/mo',
              popular: true,
              features: ['AI-image posts', 'Content campaigns', 'Revenue Opportunities', 'Automatic lead replies', '24/7 automation', 'Monthly PDF reports', 'Website diagnosis', 'Support'],
            },
          ],
        },
      },
    },
    footer: {
      tagline: 'Seu gerente de crescimento com IA — marketing e vendas no piloto automático.',
      copy: '© 2026 SalesBoost. Todos os direitos reservados.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      how: 'How it works',
      pricing: 'Pricing',
      cta: '3 free days',
    },
    trialModal: {
      badge: 'Before you start',
      title: 'Your 3 free days start now',
      body: "Try everything for 3 days. After that, it's just one simple price — and you're only charged if you decide to continue:",
      priceFrom: '',
      priceTo: '$2.99',
      priceNote: '/mo',
      cta: 'Start my 3 free days →',
      dismiss: 'Close',
    },
    hero: {
      meta: [
        { label: 'Product', value: 'SaaS Platform' },
        { label: 'Segment', value: 'Any business' },
        { label: 'Results in', value: '24 hours' },
      ],
      headline: ['The AI that grows', 'your business.', 'You just approve.'],
      sub: 'Your social media, campaigns, and customer service in one cycle: attract, convert, and sell — on autopilot, always waiting for your OK.',
      project: ['SalesBoost', 'Platform'],
      typeLabel: 'Model:',
      typeValue: 'Automated',
      sideLabels: ['Social', 'Campaigns', 'Service', 'Sales'],
      bgWord: 'SALES',
      date: 'Jun 11',
      year: '2026',
      location: 'São Paulo, Brasil',
      reportTitle: 'Monthly Report',
      scoreLabel: 'Health Score',
      reportItems: [
        { icon: '📲', text: 'Posts published' },
        { icon: '🎯', text: 'Campaign live' },
        { icon: '💬', text: 'Leads answered' },
      ],
      reportCta: 'See 3 Monthly Actions →',
    },
    stats: {
      badge: 'Proven results',
      intro: 'We are the platform that brings social media, campaigns, and customer service into one cycle — turning your digital presence into more sales, on autopilot and always with your approval.',
      items: [
        { value: '38%', label: 'Revenue growth' },
        { value: '2.4×', label: 'More customers served' },
        { value: '24h', label: 'First result' },
      ],
    },
    features: {
      badge: '3 pillars that sell',
      title1: 'The 3',
      title2: 'Pillars',
      pillars: [
        {
          num: '01',
          title: 'Social media',
          desc: 'Content and posts ready for your channels every week — built to reach the right customer and bring new people to your business.',
        },
        {
          num: '02',
          title: 'Campaigns',
          desc: 'Campaigns built around what is trending in your segment — to turn followers into customers and drive sales.',
        },
        {
          num: '03',
          title: 'Customer service',
          desc: 'Replies to every lead instantly and handles the conversation until the sale closes. No one is left waiting, no sale is left behind.',
        },
      ],
    },
    how: {
      badge: 'The cycle that makes money',
      title1: 'How it',
      title2: 'works',
      steps: [
        {
          num: '01',
          title: 'Connect your channels',
          desc: 'Link your Instagram and Facebook in seconds. Your whole digital presence in one place.',
        },
        {
          num: '02',
          title: 'Content and campaigns ready',
          desc: 'The platform creates posts and campaigns for your audience — you just approve what goes live.',
        },
        {
          num: '03',
          title: 'Serve and sell more',
          desc: 'Answer customers instantly and close sales. The cycle repeats and brings more money every month.',
        },
      ],
    },
    showcase: {
      badge: 'Full platform',
      title1: 'Everything you need,',
      title2: 'wherever you are.',
      sub: 'Social media, campaigns, and customer service working together — a cycle that turns your digital presence into more sales, every month.',
      features: [
        'Posts ready for your social media',
        'Campaigns that bring new customers',
        'Fast replies to every lead',
        'One dashboard for everything',
      ],
    },
    statement: {
      eyebrow: 'The product',
      line1: "It's not just presence.",
      line2: "It's presence that sells.",
      sub: 'Social media, campaigns, and customer service in one cycle — to turn followers into customers and customers into revenue, month after month.',
      cta: 'See demo report',
    },
    pricing: {
      badge: 'Simple pricing',
      title1: 'Plans for',
      title2: 'every size',
      popular: 'Most popular',
      cta: 'Start now',
      regions: {
        br: {
          label: '🇧🇷 Brasil',
          plans: [
            {
              name: 'SalesBoost',
              price: 'R$14,49',
              period: '/mês',
              popular: true,
              features: ['AI-image posts', 'Content campaigns', 'Revenue Opportunities', 'Automatic lead replies', '24/7 automation', 'Monthly PDF reports', 'Website diagnosis', 'Support'],
            },
          ],
        },
        us: {
          label: '🇺🇸 USA',
          plans: [
            {
              name: 'SalesBoost',
              price: '$2.99',
              period: '/mo',
              popular: true,
              features: ['AI-image posts', 'Content campaigns', 'Revenue Opportunities', 'Automatic lead replies', '24/7 automation', 'Monthly PDF reports', 'Website diagnosis', 'Support'],
            },
          ],
        },
      },
    },
    footer: {
      tagline: 'Your AI growth manager — marketing and sales on autopilot.',
      copy: '© 2026 SalesBoost. All rights reserved.',
    },
  },
}
