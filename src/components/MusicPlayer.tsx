import { useEffect, useRef, useState } from 'react';
import {
  Disc3,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';
import type { TrackDefinition } from '../data/tracks';

interface MusicPlayerProps {
  track: TrackDefinition;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (timeSec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MusicPlayer({
  track,
  isPlaying,
  currentTime,
  volume,
  isMuted,
  isLooping,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleLoop,
}: MusicPlayerProps) {
  const [imgError, setImgError] = useState(false);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setImgError(false);
  }, [track.id]);

  // Jarring Cyan vs. Magenta Pixel Spectrum Visualizer
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const bars = 20;

    const renderSpectrum = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const data = synthEngine.getFrequencyData();
      const gap = 3;
      const barWidth = Math.floor((width - gap * (bars - 1)) / bars);

      for (let i = 0; i < bars; i++) {
        const binIndex = Math.min(data.length - 1, Math.floor((i / bars) * (data.length * 0.65)));
        const raw = data[binIndex] ?? 0;
        const normalized = isPlaying && !isMuted ? raw / 255 : 0;
        // Quantize bar heights to pixel steps for raw digital readout
        const steppedHeight = Math.max(4, Math.round((normalized * (height - 4)) / 4) * 4);

        const x = i * (barWidth + gap);
        const y = height - steppedHeight;

        const isEven = i % 2 === 0;
        ctx.fillStyle =
          isPlaying && !isMuted
            ? isEven
              ? '#00FFFF'
              : '#FF00FF'
            : 'rgba(0, 255, 255, 0.22)';
        ctx.fillRect(x, y, barWidth, steppedHeight);

        if (isPlaying && !isMuted && steppedHeight > 6) {
          ctx.fillStyle = isEven ? '#FF00FF' : '#00FFFF';
          ctx.fillRect(x, Math.max(0, y - 3), barWidth, 2);
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderSpectrum);
    };

    rafId = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isMuted]);

  const progressPct =
    track.durationSec > 0 ? Math.min(100, (currentTime / track.durationSec) * 100) : 0;
  const volumePct = isMuted ? 0 : Math.round(volume * 100);

  return (
    <aside
      aria-label="Audio Stream Console"
      className="flex flex-1 flex-col justify-between bg-[#06060A] border-2 border-[#FF00FF]/80 shadow-[4px_4px_0_#00FFFF] p-4 sm:p-5"
    >
      <div>
        <div className="flex items-baseline justify-between pb-3.5 border-b-2 border-[#FF00FF]/40">
          <h2
            data-text="AUDIO_DECK"
            className="glitch-text font-display text-xs sm:text-sm text-[#FF00FF] tracking-wider"
          >
            AUDIO_DECK
          </h2>
          <span
            className={`font-mono text-xl ${
              isPlaying ? 'text-[#00FFFF]' : 'text-[#FF00FF]/75'
            }`}
          >
            {isPlaying ? 'STREAMING' : 'STANDBY'}
          </span>
        </div>

        {/* Pixel-Framed Album Art */}
        <div className="mt-4 relative aspect-square w-full overflow-hidden border-2 border-[#00FFFF] bg-black shadow-[4px_4px_0_#FF00FF]">
          {!imgError ? (
            <img
              src={track.coverUrl}
              alt={`${track.title} signal cover`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover contrast-125 saturate-150 ${
                isPlaying ? 'screen-tear' : ''
              }`}
            />
          ) : (
            <div
              className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br ${track.fallbackGradient}`}
            >
              <Disc3 className="h-10 w-10 text-[#00FFFF] neon-icon-cyan" />
              <span className="font-display text-xs text-[#E6FFFF]">
                {track.title}
              </span>
            </div>
          )}

          {/* Scanlines over art */}
          <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-75" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 to-transparent" />
        </div>

        {/* Track Metadata */}
        <div className="mt-4">
          <h3
            data-text={track.title}
            className="glitch-text font-display text-sm sm:text-base text-[#00FFFF] truncate max-w-full"
          >
            {track.title}
          </h3>
          <p className="mt-1.5 text-[11px] text-[#FF00FF] truncate">
            <span>{track.artist}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#00FFFF]">
              //
            </span>
            <span>{track.genre}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#00FFFF]">
              //
            </span>
            <span className="font-mono text-base tabular-nums">{track.bpm}_BPM</span>
          </p>
        </div>

        {/* Live Pixel Spectrum */}
        <div className="mt-3.5 h-12 w-full bg-black border-2 border-[#00FFFF]/55 px-2 py-2">
          <canvas
            ref={spectrumCanvasRef}
            className="h-full w-full block"
            aria-label="Audio frequency spectrum"
          />
        </div>
      </div>

      {/* Transport & Scrubber */}
      <div className="mt-5">
        <div>
          <input
            type="range"
            min={0}
            max={track.durationSec}
            step={0.5}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek audio position"
            className="neon-range w-full"
            style={{
              background: `linear-gradient(to right, #FF00FF ${progressPct}%, rgba(0,255,255,0.22) ${progressPct}%)`,
              height: '6px',
            }}
          />
          <div className="mt-1.5 flex items-center justify-between font-mono text-xl text-[#00FFFF] tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span className="text-[#FF00FF]">{formatTime(track.durationSec)}</span>
          </div>
        </div>

        {/* Brutalist Pixel Playback Controls */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleLoop}
            aria-pressed={isLooping}
            aria-label={isLooping ? 'Disable cycle loop' : 'Enable cycle loop'}
            title={isLooping ? 'LOOP_LOCKED' : 'AUTO_SEQUENCE'}
            className={`inline-flex h-11 w-11 items-center justify-center border-2 transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
              isLooping
                ? 'border-[#FF00FF] bg-[#FF00FF]/20 text-[#FF00FF] shadow-[2px_2px_0_#00FFFF]'
                : 'border-[#00FFFF]/40 bg-black text-[#00FFFF] hover:border-[#00FFFF]'
            }`}
          >
            <Repeat
              className={`h-4 w-4 ${
                isLooping ? 'text-[#FF00FF] neon-icon-magenta' : 'neon-icon-cyan'
              }`}
            />
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onPrevTrack}
              aria-label="Previous signal"
              className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] hover:bg-[#00FFFF]/15 active:translate-x-[1px] active:translate-y-[1px] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
            >
              <SkipBack className="h-5 w-5 neon-icon-cyan" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Halt audio stream' : 'Engage audio stream'}
              className={`inline-flex h-12 w-14 items-center justify-center border-2 bg-black active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
                isPlaying
                  ? 'border-[#FF00FF] text-[#FF00FF] shadow-[4px_4px_0_#00FFFF] hover:bg-[#FF00FF]/15'
                  : 'border-[#00FFFF] text-[#00FFFF] shadow-[4px_4px_0_#FF00FF] hover:bg-[#00FFFF]/15'
              }`}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-[#FF00FF] neon-icon-magenta" />
              ) : (
                <Play className="h-5 w-5 text-[#00FFFF] neon-icon-cyan translate-x-[1px]" />
              )}
            </button>

            <button
              type="button"
              onClick={onNextTrack}
              aria-label="Next signal"
              className="inline-flex h-11 w-11 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] hover:bg-[#00FFFF]/15 active:translate-x-[1px] active:translate-y-[1px] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
            >
              <SkipForward className="h-5 w-5 neon-icon-cyan" />
            </button>
          </div>

          <div className="w-11" aria-hidden="true" />
        </div>

        {/* Volume Row */}
        <div className="mt-4 pt-4 border-t-2 border-[#00FFFF]/30 flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Restore audio gain' : 'Mute audio gain'}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#00FFFF]/50 bg-black hover:border-[#FF00FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-[#FF00FF] neon-icon-magenta" />
            ) : (
              <Volume2 className="h-4 w-4 text-[#00FFFF] neon-icon-cyan" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Output gain"
            className="neon-range flex-1"
            style={{
              background: `linear-gradient(to right, #00FFFF ${volumePct}%, rgba(255,0,255,0.22) ${volumePct}%)`,
              height: '6px',
            }}
          />

          <span className="w-10 text-right font-mono text-xl text-[#FF00FF] tabular-nums">
            {volumePct}%
          </span>
        </div>
      </div>
    </aside>
  );
}
