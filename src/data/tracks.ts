export interface TrackDefinition {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  durationSec: number;
  accentHex: string;
  secondaryHex: string;
  coverUrl: string;
  fallbackGradient: string;
  pattern: {
    chords: number[][]; // 4 bars of MIDI note arrays
    bass: number[]; // 16-step MIDI sequence per bar (0 = rest)
    lead: number[]; // 16-step MIDI sequence per bar (0 = rest)
    arp: number[]; // 16-step MIDI sequence per bar (0 = rest)
    leadWave: OscillatorType;
    bassWave: OscillatorType;
    padWave: OscillatorType;
    filterCutoff: number;
    drumStyle: 'synthwave' | 'darksynth' | 'ambient';
  };
}

export const AI_TRACKS: TrackDefinition[] = [
  {
    id: 'neon-horizon',
    title: 'NEON_HORIZON',
    artist: 'CORE_SYNTH_01',
    genre: 'SYNTHWAVE',
    bpm: 118,
    durationSec: 104,
    accentHex: '#00FFFF',
    secondaryHex: '#FF00FF',
    coverUrl: '/src/assets/images/album_neon_horizon_1795162558215.jpg',
    fallbackGradient: 'from-[#00FFFF]/30 via-[#FF00FF]/25 to-black',
    pattern: {
      // Am - F - C - G
      chords: [
        [57, 60, 64, 69],
        [53, 57, 60, 65],
        [60, 64, 67, 72],
        [55, 59, 62, 67],
      ],
      // Driving 8th-note octave bass (root offsets per bar handled in engine)
      bass: [33, 0, 33, 45, 33, 0, 33, 45, 33, 0, 33, 45, 33, 0, 33, 45],
      lead: [76, 0, 0, 72, 0, 74, 0, 0, 79, 0, 76, 0, 72, 0, 69, 0],
      arp: [69, 72, 76, 81, 69, 72, 76, 81, 69, 72, 76, 81, 69, 72, 76, 79],
      leadWave: 'sawtooth',
      bassWave: 'sawtooth',
      padWave: 'triangle',
      filterCutoff: 1900,
      drumStyle: 'synthwave',
    },
  },
  {
    id: 'midnight-grid',
    title: 'MIDNIGHT_GRID',
    artist: 'CORE_SYNTH_02',
    genre: 'DARKSYNTH',
    bpm: 128,
    durationSec: 112,
    accentHex: '#FF00FF',
    secondaryHex: '#00FFFF',
    coverUrl: '/src/assets/images/album_midnight_grid_1795162557488.jpg',
    fallbackGradient: 'from-[#FF00FF]/35 via-[#00FFFF]/20 to-black',
    pattern: {
      // Dm - Bb - Gm - A7
      chords: [
        [50, 53, 57, 62],
        [46, 50, 53, 58],
        [55, 58, 62, 67],
        [57, 61, 64, 69],
      ],
      bass: [38, 38, 50, 38, 38, 38, 50, 38, 38, 38, 50, 38, 38, 50, 38, 50],
      lead: [74, 0, 77, 0, 76, 0, 74, 0, 81, 0, 79, 0, 77, 76, 74, 0],
      arp: [62, 65, 69, 74, 69, 65, 62, 65, 62, 65, 69, 74, 77, 74, 69, 65],
      leadWave: 'square',
      bassWave: 'sawtooth',
      padWave: 'sawtooth',
      filterCutoff: 1450,
      drumStyle: 'darksynth',
    },
  },
  {
    id: 'orbital-drift',
    title: 'ORBITAL_DRIFT',
    artist: 'CORE_SYNTH_03',
    genre: 'AMBIENT_OS',
    bpm: 92,
    durationSec: 128,
    accentHex: '#00FFFF',
    secondaryHex: '#FF00FF',
    coverUrl: '/src/assets/images/album_orbital_drift_1795162557528.jpg',
    fallbackGradient: 'from-[#00FFFF]/25 via-[#FF00FF]/25 to-black',
    pattern: {
      // Fmaj7 - Em7 - Dm7 - Cmaj7
      chords: [
        [53, 57, 60, 64],
        [52, 55, 59, 62],
        [50, 53, 57, 60],
        [48, 52, 55, 59],
      ],
      bass: [41, 0, 0, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 0, 0],
      lead: [76, 0, 0, 0, 79, 0, 72, 0, 0, 0, 74, 0, 76, 0, 0, 0],
      arp: [65, 0, 69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 65, 0, 72, 0],
      leadWave: 'sine',
      bassWave: 'triangle',
      padWave: 'sine',
      filterCutoff: 1200,
      drumStyle: 'ambient',
    },
  },
];
