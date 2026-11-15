// Gerenciador de Áudio Web e Notificações Sonoras para iOS (iPhone/Safari), Android e Desktop

let sharedAudioContext: AudioContext | null = null;
let audioInicializado = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

/**
 * Desbloqueia a saída de áudio no iOS Safari através de gesto do usuário.
 */
export function desbloquearAudio(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Cria e toca um micro-buffer inaudível de ativação exigido pelo WebKit/Safari
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioInicializado = true;
  } catch {
    // Ignora se o navegador restringir
  }
}

// Vincula ouvintes passivos em gestos iniciais do usuário para garantir desbloqueio no iPhone
if (typeof window !== 'undefined') {
  const eventos = ['touchstart', 'touchend', 'click', 'keydown'];
  const listener = () => {
    desbloquearAudio();
    if (audioInicializado) {
      eventos.forEach((evt) => window.removeEventListener(evt, listener));
    }
  };
  eventos.forEach((evt) => {
    window.addEventListener(evt, listener, { passive: true, once: false });
  });
}

/**
 * Toca um sino/carrilhão harmonioso, nítido e de alta clareza (tipo sinos de recepção/chamada celestial).
 * Funciona perfeitamente em iOS e Android.
 */
export function tocarSinoChamada(): void {
  // Vibração tátil do aparelho (quando suportada pelo hardware)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([350, 100, 350, 100, 500]);
    }
  } catch {
    // Opcional
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime;

    // Frequências das notas de um carrilhão celestial cristalino (D5 -> A5 -> D6)
    const sequencia = [
      { freq: 587.33, overtone: 1174.66, inicio: 0, duracao: 0.55, vol: 0.4 },
      { freq: 880.0, overtone: 1760.0, inicio: 0.18, duracao: 0.65, vol: 0.45 },
      { freq: 1174.66, overtone: 2349.32, inicio: 0.4, duracao: 0.95, vol: 0.5 },
    ];

    sequencia.forEach((nota) => {
      const horaNota = t0 + nota.inicio;

      // Oscilador Principal (Fundamental - Sine suave e encorpado)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(nota.freq, horaNota);

      // Oscilador Harmônico (Harmônico agudo cristalino - Triangle para brilho)
      const oscHarmonico = ctx.createOscillator();
      const gainHarmonico = ctx.createGain();
      oscHarmonico.type = 'triangle';
      oscHarmonico.frequency.setValueAtTime(nota.overtone, horaNota);

      // Envelope de sino do oscilador fundamental (ataque ultra-rápido de 8ms e decaimento exponencial)
      gain.gain.setValueAtTime(0.0001, horaNota);
      gain.gain.exponentialRampToValueAtTime(nota.vol, horaNota + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, horaNota + nota.duracao);

      // Envelope do brilho harmônico
      gainHarmonico.gain.setValueAtTime(0.0001, horaNota);
      gainHarmonico.gain.exponentialRampToValueAtTime(nota.vol * 0.35, horaNota + 0.006);
      gainHarmonico.gain.exponentialRampToValueAtTime(0.0001, horaNota + nota.duracao * 0.6);

      osc.connect(gain);
      oscHarmonico.connect(gainHarmonico);
      gain.connect(ctx.destination);
      gainHarmonico.connect(ctx.destination);

      osc.start(horaNota);
      oscHarmonico.start(horaNota);
      osc.stop(horaNota + nota.duracao + 0.05);
      oscHarmonico.stop(horaNota + nota.duracao + 0.05);
    });
  } catch {
    // Áudio restrito
  }
}

/**
 * Anúncio de voz por sintetizador nativo
 */
export function falarChamadaVoz(numeroSenha: number, nome: string, entidade: string): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const texto = `Atenção. Senha ${numeroSenha}. ${nome}. Atendimento com ${entidade}.`;
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    utter.rate = 0.92;
    utter.pitch = 1.05;
    window.speechSynthesis.speak(utter);
  } catch {
    // Síntese de voz opcional
  }
}
