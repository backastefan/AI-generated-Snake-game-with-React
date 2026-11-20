import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { synthEngine } from './audio/synthEngine';
import MusicPlayer from './components/MusicPlayer';
import PlaylistPanel from './components/PlaylistPanel';
import SnakeArena from './components/SnakeArena';
import { AI_TRACKS } from './data/tracks';

export default function App() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.72);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const userPausedRef = useRef(false);
  const isLoopingRef = useRef(isLooping);
  const currentIndexRef = useRef(currentTrackIndex);
  const isPlayingRef = useRef(isMusicPlaying);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    currentIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  useEffect(() => {
    isPlayingRef.current = isMusicPlaying;
  }, [isMusicPlaying]);

  const currentTrack = AI_TRACKS[currentTrackIndex];

  const selectTrack = useCallback((index: number, autoPlay = true) => {
    const normalized = (index + AI_TRACKS.length) % AI_TRACKS.length;
    setCurrentTrackIndex(normalized);
    setCurrentTime(0);

    const track = AI_TRACKS[normalized];
    if (autoPlay) {
      userPausedRef.current = false;
      setIsMusicPlaying(true);
      synthEngine.loadTrack(track, true);
    } else {
      synthEngine.loadTrack(track, isPlayingRef.current);
    }
  }, []);

  const handleNextTrack = useCallback(() => {
    selectTrack(currentIndexRef.current + 1, true);
  }, [selectTrack]);

  const handlePrevTrack = useCallback(() => {
    if (currentTime > 3) {
      synthEngine.seek(0);
      setCurrentTime(0);
      return;
    }
    selectTrack(currentIndexRef.current - 1, true);
  }, [currentTime, selectTrack]);

  const handleTogglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      userPausedRef.current = true;
      synthEngine.pause();
      setIsMusicPlaying(false);
    } else {
      userPausedRef.current = false;
      synthEngine.play();
      setIsMusicPlaying(true);
    }
  }, []);

  const handleStartGameAudio = useCallback(() => {
    if (!isPlayingRef.current && !userPausedRef.current) {
      synthEngine.play();
      setIsMusicPlaying(true);
    }
  }, []);

  const handleSeek = useCallback((timeSec: number) => {
    synthEngine.seek(timeSec);
    setCurrentTime(timeSec);
  }, []);

  const handleVolumeChange = useCallback(
    (vol: number) => {
      setVolume(vol);
      if (vol > 0 && isMuted) {
        setIsMuted(false);
      }
      synthEngine.setVolume(vol);
    },
    [isMuted]
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      synthEngine.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    synthEngine.loadTrack(AI_TRACKS[0], false);
    synthEngine.setCallbacks({
      onTimeUpdate: (timeSec) => {
        setCurrentTime(timeSec);
      },
      onTrackEnded: () => {
        if (isLoopingRef.current) {
          synthEngine.loadTrack(AI_TRACKS[currentIndexRef.current], true);
        } else {
          const nextIdx = (currentIndexRef.current + 1) % AI_TRACKS.length;
          setCurrentTrackIndex(nextIdx);
          synthEngine.loadTrack(AI_TRACKS[nextIdx], true);
        }
      },
    });

    return () => {
      synthEngine.pause();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '[') {
        e.preventDefault();
        handlePrevTrack();
      } else if (e.key === ']') {
        e.preventDefault();
        handleNextTrack();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handlePrevTrack, handleNextTrack]);

  return (
    <div className="relative min-h-screen bg-[#020204] text-[#E6FFFF] flex flex-col overflow-x-hidden">
      {/* Static Noise & CRT Scanlines Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-30 static-noise opacity-25"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-30 crt-scanlines opacity-65"
        aria-hidden="true"
      />

      {/* Top Navigation Bar (3-Zone Contract, Brutalist Pixel Glitch Art) */}
      <header className="relative z-20 border-b-2 border-[#FF00FF] bg-[#06060A]">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-4 py-3.5 sm:px-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#arcade-section"
            data-text="SYNTHSNAKE.EXE"
            className="glitch-text font-display text-sm sm:text-base text-[#00FFFF] tracking-wider whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
          >
            SYNTHSNAKE.EXE
          </a>

          {/* Zone 2: Single-line machine navigation links */}
          <nav
            aria-label="Primary subsystems"
            className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider text-[#E6FFFF]"
          >
            <a
              href="#arcade-section"
              data-text="ARENA_GRID"
              className="glitch-text text-[#00FFFF] hover:text-[#FF00FF] transition-colors whitespace-nowrap shrink-0"
            >
              ARENA_GRID
            </a>
            <a
              href="#playlist-section"
              className="hover:text-[#FF00FF] transition-colors whitespace-nowrap shrink-0"
            >
              SIGNAL_BANK
            </a>
            <a
              href="#player-section"
              className="hover:text-[#00FFFF] transition-colors whitespace-nowrap shrink-0"
            >
              AUDIO_DECK
            </a>
          </nav>

          {/* Zone 3: Primary Audio Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`inline-flex items-center gap-2 border-2 bg-black px-3.5 py-2 text-[11px] font-bold transition-all duration-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
                isMusicPlaying
                  ? 'border-[#FF00FF] text-[#FF00FF] shadow-[3px_3px_0_#00FFFF] hover:bg-[#FF00FF]/15'
                  : 'border-[#00FFFF] text-[#00FFFF] shadow-[3px_3px_0_#FF00FF] hover:bg-[#00FFFF]/15'
              }`}
            >
              {isMusicPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-[#FF00FF] neon-icon-magenta" />
                  HALT_AUDIO
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-[#00FFFF] neon-icon-cyan" />
                  INIT_AUDIO
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column Glitch Art Command Deck */}
      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[310px_minmax(0,1fr)_330px] items-stretch">
          {/* Left: 3 Demo AI Tracks & Input Matrix */}
          <div className="order-2 lg:order-1 flex flex-col">
            <PlaylistPanel
              tracks={AI_TRACKS}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isMusicPlaying}
              onSelectTrack={(idx) => selectTrack(idx, true)}
            />
          </div>

          {/* Center Window: Serpent Execution Arena */}
          <div className="order-1 lg:order-2 flex flex-col">
            <SnakeArena
              isMusicPlaying={isMusicPlaying}
              trackAccentHex={currentTrack.accentHex}
              onStartGameAudio={handleStartGameAudio}
            />
          </div>

          {/* Right: Audio Deck & Pixel Spectrum */}
          <div id="player-section" className="order-3 flex flex-col">
            <MusicPlayer
              track={currentTrack}
              isPlaying={isMusicPlaying}
              currentTime={currentTime}
              volume={volume}
              isMuted={isMuted}
              isLooping={isLooping}
              onTogglePlay={handleTogglePlay}
              onPrevTrack={handlePrevTrack}
              onNextTrack={handleNextTrack}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
              onToggleLoop={() => setIsLooping((l) => !l)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
