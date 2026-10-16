import React from 'react';
import {AbsoluteFill, Composition, Img, registerRoot, staticFile} from 'remotion';

const ORANGE = '#FF6D29';
const BG = '#0E0B0A';
const CARD = '#150E08';
const MUTED = '#BABABA';
const FONT = "'Bricolage', system-ui, sans-serif";
const fontCss = `
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0000-00FF, U+2000-206F, U+2190-21FF; }
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage-ext.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0100-02AF; }
`;

type Scene = {
  n: number;
  time: string;
  title: string;
  katana?: string; // cena gerada pelo Katana (fundo)
  real?: string; // tela real do painel
  lines: React.ReactNode[];
  claude: string; // o que o Claude anima por cima
};

const O: React.FC<{children: React.ReactNode}> = ({children}) => <span style={{color: ORANGE}}>{children}</span>;

const SCENES: Scene[] = [
  {
    n: 1,
    time: '0–3s',
    title: 'Curiosidade',
    katana: 'Mão segurando celular, rolando feed de imóveis. Ao fundo, Copacabana ao entardecer, desfocada. Luz laranja.',
    lines: [<>Seu próximo cliente está no Instagram agora.</>, <O>Só não está te vendo.</O>],
    claude: 'Frase entra palavra por palavra (estilo Apple). 2ª linha aparece com brilho laranja.',
  },
  {
    n: 2,
    time: '3–8s',
    title: 'Dor do corretor',
    katana: 'Drone lento sobre prédios de Botafogo à noite. Muitas janelas apagadas. Tom frio.',
    lines: [<>Imóvel parado.</>, <>Post sem resposta.</>, <O>Visita que não sai.</O>],
    claude: 'Três frases em cortes secos, uma por batida. Leve tremida na câmera.',
  },
  {
    n: 3,
    time: '8–14s',
    title: 'Revelação',
    lines: [<>Sales Boost</>, <>A IA que transforma seus imóveis em <O>demanda.</O></>],
    claude: 'Tela preta → feixe de luz laranja varre a tela → logo aparece com brilho. Sem Katana (custo zero).',
  },
  {
    n: 4,
    time: '14–24s',
    title: 'Como gera demanda',
    katana: 'Skyline do Rio com o Pão de Açúcar, bem desfocado e escurecido (só textura de fundo).',
    real: 'Telas reais do painel flutuando em 3D: estratégia, concorrentes, posts prontos.',
    lines: [
      <><O>1</O> Estuda seu bairro e concorrentes</>,
      <><O>2</O> Monta a estratégia</>,
      <><O>3</O> Cria posts com fotos reais</>,
      <><O>4</O> Responde quem pergunta</>,
    ],
    claude: 'Cada passo acende junto com a tela correspondente, que gira levemente em 3D com brilho na borda.',
  },
  {
    n: 5,
    time: '24–30s',
    title: 'Confiança',
    real: 'Tela real de aprovação do painel, com o botão "Aprovar".',
    lines: [<>Você aprova tudo.</>, <O>Seu nome. Seu CRECI. Sua marca.</O>],
    claude: 'Zoom na tela, cursor/dedo toca "Aprovar", botão pulsa em laranja. Sem Katana (custo zero).',
  },
  {
    n: 6,
    time: '30–35s',
    title: 'Chamada final',
    katana: 'Aéreo do Rio ao anoitecer, câmera subindo devagar até a cidade virar luzes.',
    lines: [<>Feito para corretores e imobiliárias.</>, <O>Diagnóstico grátis</O>, <>getsaleboost.com</>],
    claude: 'Cidade escurece até o preto da marca. Logo + site entram e ficam parados no fim.',
  },
];

const Frame: React.FC<{s: Scene}> = ({s}) => (
  <div
    style={{
      width: 540,
      height: 960,
      borderRadius: 36,
      overflow: 'hidden',
      position: 'relative',
      background: s.katana
        ? `radial-gradient(120% 70% at 50% 85%, #5a2a10 0%, #22140c 45%, ${BG} 80%)`
        : BG,
      border: '2px solid #2a1c12',
    }}
  >
    {s.katana && (
      <div style={tag(true)}>🎥 KATANA · fundo</div>
    )}
    {s.n === 3 && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(115deg, transparent 40%, ${ORANGE}55 50%, transparent 60%)`,
        }}
      />
    )}
    {s.real && (
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: s.n === 4 ? 120 : 170,
          height: s.n === 4 ? 300 : 330,
          borderRadius: 20,
          background: CARD,
          border: `2px dashed ${ORANGE}`,
          boxShadow: `0 0 60px ${ORANGE}44`,
          transform: s.n === 4 ? 'perspective(900px) rotateY(-14deg) rotateX(6deg)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 24,
          color: MUTED,
          fontSize: 22,
        }}
      >
        🖥️ Print real do painel
      </div>
    )}
    <div
      style={{
        position: 'absolute',
        left: 44,
        right: 44,
        bottom: s.real ? 120 : 0,
        top: s.real ? undefined : 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: s.n === 4 ? 18 : 16,
      }}
    >
      {s.n === 3 && <Img src={staticFile('logo.png')} style={{width: 110, borderRadius: 24, marginBottom: 10}} />}
      {s.lines.map((l, i) => (
        <div
          key={i}
          style={{
            fontSize: s.n === 4 ? 32 : s.n === 3 && i === 0 ? 64 : 44,
            fontWeight: s.n === 4 ? 600 : 800,
            lineHeight: 1.08,
            letterSpacing: -1,
            color: 'white',
          }}
        >
          {l}
        </div>
      ))}
    </div>
    <div style={{position: 'absolute', left: 0, bottom: 0, height: 6, width: `${(s.n / 6) * 100}%`, background: ORANGE}} />
  </div>
);

const tag = (k: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 22,
  left: 22,
  padding: '8px 16px',
  borderRadius: 999,
  background: k ? '#000a' : CARD,
  border: `1px solid ${ORANGE}`,
  color: ORANGE,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 1,
});

const Note: React.FC<{label: string; text: string; color?: string}> = ({label, text, color = MUTED}) => (
  <div style={{fontSize: 22, lineHeight: 1.35, color, marginTop: 12}}>
    <b style={{color: 'white'}}>{label} </b>
    {text}
  </div>
);

const Board: React.FC = () => (
  <AbsoluteFill style={{background: BG, fontFamily: FONT, color: 'white', padding: 70}}>
    <style>{fontCss}</style>
    <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
      <Img src={staticFile('logo.png')} style={{width: 90, borderRadius: 20}} />
      <div>
        <div style={{fontSize: 56, fontWeight: 800, letterSpacing: -1}}>Storyboard · Apresentação Sales Boost</div>
        <div style={{fontSize: 28, color: MUTED}}>
          Vertical 9:16 · ~35s · Estilo: <O>escuro com brilho</O> + <O>telas reais</O> · abertura em tipografia
        </div>
      </div>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 540px)', columnGap: 80, rowGap: 70, marginTop: 60}}>
      {SCENES.map((s) => (
        <div key={s.n}>
          <div style={{fontSize: 30, fontWeight: 800, marginBottom: 16}}>
            <O>{s.n}</O> · {s.title} <span style={{color: MUTED, fontWeight: 500}}>({s.time})</span>
          </div>
          <Frame s={s} />
          {s.katana && <Note label="🎥 Katana:" text={s.katana} />}
          {s.real && <Note label="🖥️ Tela real:" text={s.real} />}
          <Note label="✨ Claude anima:" text={s.claude} />
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition id="Board" component={Board} durationInFrames={1} fps={30} width={1920} height={3000} />
));
