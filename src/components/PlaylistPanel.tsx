import { useState } from 'react';
import { Disc3, Keyboard } from 'lucide-react';
import type { TrackDefinition } from '../data/tracks';

interface PlaylistPanelProps {
  tracks: TrackDefinition[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function TrackThumbnail({
  track,
  isActive,
  isPlaying,
}: {
  track: TrackDefinition;
  isActive: boolean;
  isPlaying: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative h-12 w-12 shrink-0 overflow-hidden bg-black border-2 ${
        isActive ? 'border-[#FF00FF]' : 'border-[#00FFFF]/50'
      }`}
    >
      {!imgError ? (
        <img
          src={track.coverUrl}
          alt={`${track.title} signal art`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover contrast-125 saturate-150"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${track.fallbackGradient}`}
        >
          <Disc3 className="h-5 w-5 text-[#00FFFF] neon-icon-cyan" />
        </div>
      )}

      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/65">
          {isPlaying ? (
            <div className="flex items-end gap-[3px] h-4" aria-hidden="true">
              <span className="w-[3px] bg-[#00FFFF] animate-[bounce_0.55s_steps(2)_infinite] h-3" />
              <span className="w-[3px] bg-[#FF00FF] animate-[bounce_0.45s_steps(2)_infinite_0.12s] h-4" />
              <span className="w-[3px] bg-[#00FFFF] animate-[bounce_0.5s_steps(2)_infinite_0.24s] h-2.5" />
            </div>
          ) : (
            <div className="h-2.5 w-2.5 bg-[#FF00FF]" />
          )}
        </div>
      )}
    </div>
  );
}

export default function PlaylistPanel({
  tracks,
  currentTrackIndex,
  isPlaying,
  onSelectTrack,
}: PlaylistPanelProps) {
  return (
    <aside
      id="playlist-section"
      aria-label="Audio Signal Bank and Input Matrix"
      className="flex flex-1 flex-col justify-between bg-[#06060A] border-2 border-[#00FFFF]/75 shadow-[4px_4px_0_#FF00FF] p-4 sm:p-5"
    >
      <div>
        <div className="flex items-baseline justify-between pb-3.5 border-b-2 border-[#00FFFF]/35">
          <h2
            data-text="SIGNAL_BANK"
            className="glitch-text font-display text-xs sm:text-sm text-[#00FFFF] tracking-wider"
          >
            SIGNAL_BANK
          </h2>
          <span className="font-mono text-xl text-[#FF00FF] tabular-nums">
            0{tracks.length}_NODES
          </span>
        </div>

        <ul className="divide-y divide-[#00FFFF]/20 mt-2" role="list">
          {tracks.map((track, idx) => {
            const isActive = idx === currentTrackIndex;
            return (
              <li key={track.id} className="py-2 first:pt-1 last:pb-1">
                <button
                  type="button"
                  onClick={() => onSelectTrack(idx)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`group flex w-full items-center gap-3 border-2 p-2 text-left transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
                    isActive
                      ? 'border-[#FF00FF] bg-[#FF00FF]/12 shadow-[3px_3px_0_#00FFFF]'
                      : 'border-transparent hover:border-[#00FFFF]/65 hover:bg-[#00FFFF]/8'
                  }`}
                >
                  <TrackThumbnail
                    track={track}
                    isActive={isActive}
                    isPlaying={isActive && isPlaying}
                  />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-bold tracking-wide ${
                        isActive
                          ? 'text-[#00FFFF]'
                          : 'text-[#E6FFFF] group-hover:text-[#00FFFF]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[#FF00FF]">
                      <span>{track.genre}</span>
                      <span aria-hidden="true" className="mx-1 text-[#00FFFF]">
                        /
                      </span>
                      <span className="font-mono text-base leading-none tabular-nums">
                        {track.bpm}BPM
                      </span>
                    </p>
                  </div>

                  <span
                    className={`font-mono text-xl tabular-nums shrink-0 ${
                      isActive ? 'text-[#FF00FF]' : 'text-[#00FFFF]/70'
                    }`}
                  >
                    {formatTime(track.durationSec)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t-2 border-[#FF00FF]/40">
        <div className="flex items-center gap-2.5 text-[#00FFFF] mb-3">
          <Keyboard className="h-4 w-4 text-[#FF00FF] neon-icon-magenta shrink-0" />
          <h3 className="font-display text-[11px] tracking-wider text-[#00FFFF]">
            INPUT_MATRIX
          </h3>
        </div>

        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#E6FFFF]/75">VECTOR_DIR</dt>
            <dd className="font-mono text-lg text-[#00FFFF] whitespace-nowrap">
              ARROWS / WASD
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#E6FFFF]/75">CYCLE_HALT</dt>
            <dd className="font-mono text-lg text-[#FF00FF] whitespace-nowrap">
              SPACE
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#E6FFFF]/75">AUDIO_GATE</dt>
            <dd className="font-mono text-lg text-[#00FFFF] whitespace-nowrap">
              KEY_M
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#E6FFFF]/75">NODE_SKIP</dt>
            <dd className="font-mono text-lg text-[#FF00FF] whitespace-nowrap">
              [ / ]
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
