import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Img,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const ORANGE = '#FF6D29';
const BG = '#0E0B0A';
const CARD = '#150E08';
const MUTED = '#BABABA';
const FONT = "'Bricolage', system-ui, sans-serif";

const fontCss = `
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Bricolage'; src: url('${staticFile('bricolage-ext.woff2')}') format('woff2'); font-weight: 200 800; unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
`;

// Entra de baixo com fade; sai com fade no fim da cena.
const Reveal: React.FC<{delay?: number; dur: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  dur,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200}});
  const out = interpolate(frame, [dur - 10, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{opacity: s * out, transform: `translateY(${(1 - s) * 60}px)`, ...style}}>{children}</div>
  );
};

const Center: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{justifyContent: 'center', padding: '0 110px', fontFamily: FONT, color: 'white'}}>
    {children}
  </AbsoluteFill>
);

const big: React.CSSProperties = {fontSize: 112, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3};
const mid: React.CSSProperties = {fontSize: 64, fontWeight: 600, lineHeight: 1.15, letterSpacing: -1};
const O: React.FC<{children: React.ReactNode}> = ({children}) => <span style={{color: ORANGE}}>{children}</span>;

const Hook: React.FC<{dur: number}> = ({dur}) => (
  <Center>
    <Reveal dur={dur} style={{...big, color: MUTED}}>Você não precisa de mais likes.</Reveal>
    <Reveal dur={dur} delay={30} style={{...big, marginTop: 50}}>
      Precisa de mais <O>clientes.</O>
    </Reveal>
  </Center>
);

const Problem: React.FC<{dur: number}> = ({dur}) => {
  const items = ['Postar todo dia', 'Responder mensagem', 'Entender anúncio', 'Acompanhar concorrente'];
  return (
    <Center>
      {items.map((t, i) => (
        <Reveal key={t} dur={dur} delay={i * 10} style={{...mid, color: MUTED, marginBottom: 18}}>
          {t}…
        </Reveal>
      ))}
      <Reveal dur={dur} delay={55} style={{...mid, fontWeight: 800, marginTop: 50}}>
        Quem tem negócio não tem tempo pra virar <O>especialista em marketing.</O>
      </Reveal>
    </Center>
  );
};

const Intro: React.FC<{dur: number}> = ({dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 12}});
  return (
    <Center>
      <Reveal dur={dur} style={{display: 'flex', alignItems: 'center', gap: 36}}>
        <Img src={staticFile('logo.png')} style={{width: 170, borderRadius: 36, transform: `scale(${pop})`}} />
        <div style={{fontSize: 96, fontWeight: 800, letterSpacing: -2}}>Sales Boost</div>
      </Reveal>
      <Reveal dur={dur} delay={20} style={{...mid, marginTop: 60}}>
        Um <O>parceiro de crescimento</O> com IA.
      </Reveal>
      <Reveal dur={dur} delay={40} style={{...mid, fontSize: 48, color: MUTED, marginTop: 30}}>
        Entende o seu negócio, monta a estratégia, executa e aprende com o resultado.
      </Reveal>
    </Center>
  );
};

const Steps: React.FC<{dur: number}> = ({dur}) => {
  const steps: [string, string][] = [
    ['Entende', 'dados reais, não achismo'],
    ['Planeja', 'onde vale colocar esforço'],
    ['Cria', 'com as suas fotos reais'],
    ['Você aprova', 'nada vai pro ar sem o seu ok'],
    ['Aprende', 'mede e ajusta o próximo passo'],
  ];
  return (
    <Center>
      {steps.map(([t, d], i) => (
        <Reveal
          key={t}
          dur={dur}
          delay={i * 18}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 36,
            background: CARD,
            border: `2px solid ${i === 3 ? ORANGE : '#2a1c12'}`,
            borderRadius: 32,
            padding: '30px 40px',
            marginBottom: 26,
          }}
        >
          <div style={{fontSize: 72, fontWeight: 800, color: ORANGE, width: 70}}>{i + 1}</div>
          <div>
            <div style={{fontSize: 56, fontWeight: 700}}>{t}</div>
            <div style={{fontSize: 38, color: MUTED}}>{d}</div>
          </div>
        </Reveal>
      ))}
    </Center>
  );
};

const Partner: React.FC<{dur: number}> = ({dur}) => (
  <Center>
    <Reveal dur={dur} style={{...big, color: MUTED}}>Não somos agência.</Reveal>
    <Reveal dur={dur} delay={25} style={{...big, marginTop: 40}}>
      Somos seus <O>parceiros.</O>
    </Reveal>
  </Center>
);

const NeverStops: React.FC<{dur: number}> = ({dur}) => (
  <Center>
    {['Não tira férias.', 'Não pede aumento.'].map((t, i) => (
      <Reveal key={t} dur={dur} delay={i * 15} style={{...big, fontSize: 96, color: MUTED, marginBottom: 20}}>
        {t}
      </Reveal>
    ))}
    <Reveal dur={dur} delay={30} style={{...big, fontSize: 96}}>
      Trabalha de <O>madrugada</O> também.
    </Reveal>
  </Center>
);

const Cta: React.FC<{dur: number}> = ({dur}) => (
  <Center>
    <Reveal dur={dur + 20} style={{...big, fontSize: 100}}>
      Nós transformamos atenção em <O>negócio.</O>
    </Reveal>
    <Reveal dur={dur + 20} delay={35} style={{display: 'flex', alignItems: 'center', gap: 28, marginTop: 110}}>
      <Img src={staticFile('logo.png')} style={{width: 120, borderRadius: 26}} />
      <div>
        <div style={{fontSize: 52, fontWeight: 700}}>Diagnóstico grátis</div>
        <div style={{fontSize: 46, color: ORANGE, fontWeight: 600}}>getsaleboost.com</div>
      </div>
    </Reveal>
  </Center>
);

const SCENES: [React.FC<{dur: number}>, number][] = [
  [Hook, 100],
  [Problem, 130],
  [Intro, 130],
  [Steps, 190],
  [Partner, 100],
  [NeverStops, 100],
  [Cta, 130],
];
const TOTAL = SCENES.reduce((a, [, d]) => a + d, 0);

const Main: React.FC = () => {
  const frame = useCurrentFrame();
  let start = 0;
  return (
    <AbsoluteFill style={{background: BG}}>
      <style>{fontCss}</style>
      {SCENES.map(([Scene, dur], i) => {
        const from = start;
        start += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Scene dur={dur} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 10,
          width: `${(frame / TOTAL) * 100}%`,
          background: ORANGE,
        }}
      />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <Composition id="Apresentacao" component={Main} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
);

registerRoot(Root);
