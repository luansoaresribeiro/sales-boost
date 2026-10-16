import React from 'react';
import {AbsoluteFill, Composition, Img, registerRoot, staticFile} from 'remotion';

// Storyboard v2 — roteiro aprovado pelo dono em 2026-10-16
// (ver docs/VIDEO-APRESENTACAO.md). Só um esboço do que cada cena mostra.

const ORANGE = '#FF6D29';
const BG = '#0E0B0A';
const CARD = '#150E08';
const MUTED = '#BABABA';
const FONT = "'Bricolage', system-ui, sans-serif";
const fontCss = `
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0000-00FF, U+2000-206F, U+2190-21FF; }
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage-ext.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0100-02AF; }
`;

type Look = 'dark' | 'orange' | 'light' | 'city';
type Prop = 'phone' | 'ring' | 'post' | 'tasks' | 'logo' | 'map' | 'carousel' | 'chat' | 'chart' | 'approve' | 'end';

type Scene = {
  id: string;
  time: string;
  look: Look;
  prop: Prop;
  ia?: string; // fundo gerado no Higgsfield (sem texto, sem imóvel)
  foto?: boolean; // usa a foto real do imóvel
  painel?: boolean; // usa print do painel
  text: React.ReactNode;
  anim: string; // o que a montagem anima por cima
};

const I: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span style={{fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: ORANGE}}>{children}</span>
);
const Iw: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span style={{fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 400}}>{children}</span>
);

const SCENES: Scene[] = [
  {
    id: '1', time: '0–3s', look: 'city', prop: 'phone',
    ia: 'Copacabana ao entardecer, câmera lenta, a luz vai escurecendo.',
    text: <>Seu próximo cliente está no Instagram <I>agora.</I></>,
    anim: 'A cidade escurece e um celular surge girando com anel de luz laranja.',
  },
  {
    id: '2', time: '3–5s', look: 'dark', prop: 'ring',
    text: <>Só não está <I>te vendo.</I></>,
    anim: 'Anel 3D de texto girando: IMÓVEIS + POSTS + VISITAS + DEMANDA +',
  },
  {
    id: '3a', time: '5–7s', look: 'orange', prop: 'post', foto: true,
    text: <>Curtidas… não agendam <Iw>visita.</Iw></>,
    anim: 'Post do imóvel com corações (número borrado) → falha na tela → "CURTIDAS" quebra em pedaços.',
  },
  {
    id: '3b', time: '7–9s', look: 'orange', prop: 'tasks',
    text: <>E fazer tudo na mão… não <Iw>escala.</Iw></>,
    anim: 'Cartões "postar", "responder", "legendar" empilham até desabar.',
  },
  {
    id: '4', time: '9–12s', look: 'dark', prop: 'logo',
    text: <>Menos sorte. Mais <I>método.</I></>,
    anim: 'Tela preta → feixe de luz laranja → logo SALES BOOST com brilho.',
  },
  {
    id: '5a', time: '12–14,5s', look: 'city', prop: 'map',
    ia: 'Vista aérea de Botafogo com o Pão de Açúcar, de dia.',
    text: <>ESTUDA <I>seu bairro</I></>,
    anim: 'Mapa estilizado se desenha por cima, com pinos laranja caindo.',
  },
  {
    id: '5b', time: '14,5–17s', look: 'orange', prop: 'carousel', foto: true,
    text: <>CRIA <Iw>posts que vendem</Iw></>,
    anim: 'Celular com carrossel do imóvel passando as fotos.',
  },
  {
    id: '5c', time: '17–19,5s', look: 'dark', prop: 'chat',
    text: <>RESPONDE <I>quem pergunta</I></>,
    anim: 'Balões de comentário/DM pulando e uma linha de fluxo se desenhando.',
  },
  {
    id: '5d', time: '19,5–22s', look: 'orange', prop: 'chart', painel: true,
    text: <>APRENDE <Iw>toda semana</Iw></>,
    anim: 'Gráfico subindo sem números + print da tela de Performance flutuando.',
  },
  {
    id: '6', time: '22–27s', look: 'light', prop: 'approve', painel: true,
    text: <>Você aprova <I>tudo.</I><br />Seu nome. Seu CRECI. Sua marca.</>,
    anim: 'Botão 3D "APROVAR" é apertado e amassa; print da tela de Aprovações atrás.',
  },
  {
    id: '7', time: '27–33s', look: 'city', prop: 'end',
    ia: 'Drone sobre o Rio à noite, subindo até a cidade virar luzes.',
    text: <>Feito para corretores e imobiliárias.<br /><I>Diagnóstico grátis</I> · getsaleboost.com</>,
    anim: 'Cidade escurece até o preto da marca; logo + site ficam parados no fim.',
  },
];

const bgFor = (look: Look): string => {
  if (look === 'orange') return ORANGE;
  if (look === 'light') return '#F4EFEA';
  if (look === 'city')
    return `linear-gradient(180deg, #1b2a44 0%, #7a3a1c 55%, #2a170c 75%, ${BG} 100%)`;
  return `radial-gradient(80% 50% at 50% 50%, #3a1a0a 0%, ${BG} 70%)`;
};

const Placeholder: React.FC<{label: string; h: number; dark?: boolean}> = ({label, h, dark}) => (
  <div
    style={{
      height: h, borderRadius: 18, border: `3px dashed ${dark ? BG : ORANGE}`,
      background: dark ? '#0002' : '#ffffff10', display: 'flex', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', fontSize: 24, fontWeight: 700,
      color: dark ? BG : 'white', padding: 16,
    }}
  >
    {label}
  </div>
);

const Phone: React.FC<{children?: React.ReactNode; glow?: boolean}> = ({children, glow}) => (
  <div
    style={{
      width: 230, height: 440, borderRadius: 38, background: '#111', border: '6px solid #2b2b2b',
      boxShadow: glow ? `0 0 0 10px ${ORANGE}55, 0 0 90px ${ORANGE}` : '0 30px 60px #0008',
      overflow: 'hidden', padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}
  >
    {children}
  </div>
);

const PropView: React.FC<{s: Scene}> = ({s}) => {
  const onOrange = s.look === 'orange';
  switch (s.prop) {
    case 'phone':
      return <Phone glow><div style={{flex: 1, borderRadius: 20, background: '#222'}} /></Phone>;
    case 'ring':
      return (
        <div style={{width: 360, height: 360, borderRadius: '50%', border: `3px solid ${ORANGE}`, transform: 'rotateX(65deg)', boxShadow: `0 0 50px ${ORANGE}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ORANGE, fontWeight: 800, fontSize: 20}}>
          IMÓVEIS + POSTS + VISITAS + DEMANDA +
        </div>
      );
    case 'post':
      return (
        <div style={{width: 340, background: 'white', borderRadius: 20, padding: 14, boxShadow: '0 30px 60px #0005', transform: 'rotate(-4deg)'}}>
          <Placeholder label="🏠 FOTO REAL do imóvel" h={300} dark />
          <div style={{fontSize: 34, marginTop: 10}}>❤️ ❤️ ❤️ <span style={{filter: 'blur(6px)', color: BG, fontWeight: 800}}>0.000</span></div>
        </div>
      );
    case 'tasks':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {['postar', 'responder', 'legendar', 'postar', 'responder'].map((t, i) => (
            <div key={i} style={{background: 'white', color: BG, fontWeight: 800, fontSize: 30, padding: '12px 30px', borderRadius: 14, marginTop: -6, transform: `rotate(${[-8, 5, -3, 9, -12][i]}deg) translateX(${[-30, 20, -10, 35, -40][i]}px)`, boxShadow: '0 10px 20px #0004'}}>
              {t}
            </div>
          ))}
        </div>
      );
    case 'logo':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
          <Img src={staticFile('logo.png')} style={{width: 150, borderRadius: 34, boxShadow: `0 0 80px ${ORANGE}`}} />
          <div style={{fontSize: 40, fontWeight: 800, letterSpacing: 2}}>SALES BOOST</div>
        </div>
      );
    case 'map':
      return (
        <div style={{width: 380, height: 300, borderRadius: 20, border: `2px solid ${ORANGE}`, background: '#0006', position: 'relative'}}>
          {[[80, 90], [220, 60], [290, 180], [140, 200]].map(([x, y], i) => (
            <div key={i} style={{position: 'absolute', left: x, top: y, fontSize: 40}}>📍</div>
          ))}
        </div>
      );
    case 'carousel':
      return (
        <Phone>
          <Placeholder label="🏠 FOTO REAL" h={300} />
          <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
            {[0, 1, 2, 3].map((i) => <div key={i} style={{width: 10, height: 10, borderRadius: 5, background: i === 0 ? ORANGE : '#555'}} />)}
          </div>
        </Phone>
      );
    case 'chat':
      return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 380}}>
          {['Qual o valor?', 'Ainda está disponível?', 'Posso visitar sábado?'].map((t, i) => (
            <div key={i} style={{alignSelf: i % 2 ? 'flex-end' : 'flex-start', background: i % 2 ? ORANGE : '#2a2420', padding: '12px 20px', borderRadius: 22, fontSize: 24, fontWeight: 600}}>{t}</div>
          ))}
        </div>
      );
    case 'chart':
      return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'flex-end', gap: 16, height: 170}}>
            {[50, 80, 70, 120, 165].map((h, i) => <div key={i} style={{width: 46, height: h, background: onOrange ? BG : ORANGE, borderRadius: 8}} />)}
          </div>
          <div style={{width: 360}}><Placeholder label="🖥️ PRINT do painel (Performance)" h={130} dark={onOrange} /></div>
        </div>
      );
    case 'approve':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
          <div style={{width: 360}}><Placeholder label="🖥️ PRINT do painel (Aprovações)" h={170} dark /></div>
          <div style={{background: ORANGE, color: 'white', fontSize: 40, fontWeight: 800, padding: '22px 60px', borderRadius: 26, boxShadow: `0 12px 0 #b4471a, 0 30px 50px #0004`}}>APROVAR</div>
        </div>
      );
    case 'end':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
          <Img src={staticFile('logo.png')} style={{width: 120, borderRadius: 28}} />
        </div>
      );
  }
};

const Frame: React.FC<{s: Scene; i: number}> = ({s, i}) => {
  const light = s.look === 'light';
  const onOrange = s.look === 'orange';
  return (
    <div style={{width: 540, height: 960, borderRadius: 36, overflow: 'hidden', position: 'relative', background: bgFor(s.look), border: '2px solid #2a1c12', color: light ? BG : 'white'}}>
      {s.ia && (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 90}}>
          <div style={{fontSize: 22, color: '#ffffffaa', textAlign: 'center', padding: '0 50px'}}>🎥 vídeo de IA ao fundo:<br />{s.ia}</div>
        </div>
      )}
      <div style={{position: 'absolute', left: 0, right: 0, top: s.ia ? 220 : 120, height: 470, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 900}}>
        <PropView s={s} />
      </div>
      <div style={{position: 'absolute', left: 40, right: 40, bottom: 70, fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, textAlign: 'center', color: onOrange ? BG : light ? BG : 'white'}}>
        {s.text}
      </div>
      <div style={{position: 'absolute', left: 0, bottom: 0, height: 8, width: `${((i + 1) / SCENES.length) * 100}%`, background: onOrange ? BG : ORANGE}} />
    </div>
  );
};

const Badge: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span style={{display: 'inline-block', padding: '6px 14px', borderRadius: 999, border: `1px solid ${ORANGE}`, color: ORANGE, fontSize: 20, fontWeight: 700, marginRight: 8, marginTop: 10}}>{children}</span>
);

const Board: React.FC = () => (
  <AbsoluteFill style={{background: BG, fontFamily: FONT, color: 'white', padding: 70}}>
    <style>{fontCss}</style>
    <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
      <Img src={staticFile('logo.png')} style={{width: 90, borderRadius: 20}} />
      <div>
        <div style={{fontSize: 56, fontWeight: 800, letterSpacing: -1}}>Storyboard v2 · Apresentação Sales Boost</div>
        <div style={{fontSize: 28, color: MUTED}}>
          Reels vertical · ~33s · cenas <span style={{color: ORANGE}}>escuras com brilho</span> alternando com cenas <span style={{color: ORANGE}}>laranja</span> · cortes rápidos
        </div>
      </div>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 540px)', columnGap: 60, rowGap: 60, marginTop: 56}}>
      {SCENES.map((s, i) => (
        <div key={s.id}>
          <div style={{fontSize: 30, fontWeight: 800, marginBottom: 14}}>
            <span style={{color: ORANGE}}>{s.id}</span> <span style={{color: MUTED, fontWeight: 500}}>· {s.time}</span>
          </div>
          <Frame s={s} i={i} />
          <div>
            {s.ia && <Badge>🎥 IA Higgsfield</Badge>}
            {s.foto && <Badge>🏠 foto real</Badge>}
            {s.painel && <Badge>🖥️ print do painel</Badge>}
          </div>
          <div style={{fontSize: 22, lineHeight: 1.35, color: MUTED, marginTop: 10}}>
            <b style={{color: 'white'}}>Animação: </b>{s.anim}
          </div>
        </div>
      ))}
      <div style={{fontSize: 26, lineHeight: 1.5, color: MUTED, paddingTop: 60}}>
        <div style={{fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 16}}>Legenda</div>
        <div>🎥 <b style={{color: 'white'}}>IA Higgsfield</b>: só cidade, sem texto e sem imóvel (3 cenas).</div>
        <div>🏠 <b style={{color: 'white'}}>Foto real</b>: foto de verdade de um imóvel bonito, com autorização.</div>
        <div>🖥️ <b style={{color: 'white'}}>Print do painel</b>: tela real do Sales Boost (conta de teste).</div>
        <div style={{marginTop: 16}}>Nenhum número inventado. Textos e logo entram na montagem, nunca pela IA.</div>
      </div>
    </div>
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition id="Board" component={Board} durationInFrames={1} fps={30} width={2580} height={3900} />
));
