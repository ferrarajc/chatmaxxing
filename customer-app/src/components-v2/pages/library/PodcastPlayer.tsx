import React, { useRef, useState } from 'react';
import { theme } from '../../../theme';
import { PodcastEpisode } from '../../../data/podcast';

function fmtTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
  episode: PodcastEpisode;
  compact?: boolean;
}

export function PodcastPlayer({ episode, compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]           = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [loaded, setLoaded]             = useState(false);

  const src = `${import.meta.env.BASE_URL}podcast/${episode.filename}`;

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const IVORY = '#FBF9F4';

  return (
    <div style={{
      background: `linear-gradient(135deg, #7A3A18 0%, ${theme.color.accent} 60%, #C47A40 100%)`,
      padding: compact ? '28px 32px' : '0 48px',
    }}>
      <div style={{ maxWidth: compact ? '100%' : 1160, margin: '0 auto', padding: compact ? 0 : '40px 0 44px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '1fr 2fr',
          gap: compact ? 20 : 48,
          alignItems: 'center',
        }}>

          {/* ── Branding ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              }}>🎙</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(251,249,244,0.6)', marginBottom: 2 }}>Podcast</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: theme.font.serif, color: IVORY, letterSpacing: '-0.01em' }}>The Bob Pod</div>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(251,249,244,0.55)', marginBottom: 8 }}>
              Episode {episode.number}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(251,249,244,0.75)', lineHeight: 1.5 }}>
              {episode.description}
            </div>
          </div>

          {/* ── Player ── */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: theme.font.serif, color: IVORY, marginBottom: 20, lineHeight: 1.2, letterSpacing: '-0.015em' }}>
              {episode.title}
            </div>

            <audio
              ref={audioRef}
              src={src}
              preload="metadata"
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => { setDuration(audioRef.current?.duration ?? 0); setLoaded(true); }}
              onEnded={() => { setPlaying(false); setCurrentTime(0); }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={togglePlay}
                style={{
                  flexShrink: 0,
                  width: 48, height: 48, borderRadius: '50%',
                  background: IVORY, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 18,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? '⏸' : '▶'}
              </button>

              <div style={{ flex: 1 }}>
                <div
                  onClick={handleSeek}
                  style={{
                    height: 6, borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)',
                    cursor: loaded ? 'pointer' : 'default',
                    position: 'relative', marginBottom: 8,
                  }}
                >
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${progress}%`, borderRadius: 999,
                    background: IVORY, transition: 'width 0.1s linear',
                  }} />
                  {loaded && (
                    <div style={{
                      position: 'absolute', top: '50%',
                      left: `${progress}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 14, height: 14, borderRadius: '50%',
                      background: IVORY,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(251,249,244,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                  <span>{fmtTime(currentTime)}</span>
                  <span>{loaded ? fmtTime(duration) : 'Loading…'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
