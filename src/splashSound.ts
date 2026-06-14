// Sonido de entrada (~1.9s) sintetizado con WebAudio: ambiente de estadio,
// pitazo de árbitro y corneta final. Sin archivos externos.
// Nota: los navegadores bloquean el audio en cargas sin interacción previa;
// en ese caso la animación corre en silencio.
export function playSplashSound(): void {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // Ambiente de estadio: ruido filtrado que crece y cae.
    const noiseLength = Math.floor(ctx.sampleRate * 1.9);
    const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 850;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.16, now + 0.6);
    noiseGain.gain.setValueAtTime(0.16, now + 1.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 1.9);

    // Pitazo de árbitro (dos pitos cortos con vibrato).
    const pip = (start: number, duration: number): void => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 2350;
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 55;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 180;
      vibrato.connect(vibratoGain).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.setValueAtTime(0.08, start + duration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + duration);
      vibrato.start(start);
      vibrato.stop(start + duration);
    };
    pip(now + 0.15, 0.16);
    pip(now + 0.42, 0.3);

    // Corneta final (acorde corto de "¡gol!").
    const horn = (frequency: number): void => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency * 0.96, now + 1.1);
      osc.frequency.linearRampToValueAtTime(frequency, now + 1.2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 1.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
      osc.connect(gain).connect(master);
      osc.start(now + 1.1);
      osc.stop(now + 1.9);
    };
    horn(233.08); // Si bemol
    horn(293.66); // Re
    horn(349.23); // Fa

    setTimeout(() => {
      void ctx.close();
    }, 2200);
  } catch {
    // Sin audio disponible: la animación corre en silencio.
  }
}
