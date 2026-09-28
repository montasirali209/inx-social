"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./UgcAdStudioShowcase.module.css";

export type CreatorMedia = {
  name: string;
  category: string;
  videoSrc: string;
};

type Props = {
  activeVideo: CreatorMedia;
  creators: CreatorMedia[];
  createHref?: string;
};

const metrics = [
  { value: "50+", label: "Creator Styles", tone: "teal", icon: "people" },
  { value: "1K+", label: "Videos Generated", tone: "blue", icon: "play" },
  { value: "98%", label: "User Satisfaction", tone: "orange", icon: "bolt" },
  { value: "3x", label: "Higher Engagement", tone: "purple", icon: "bars" }
] as const;

const features = [
  { title: "Realistic creator videos", text: "That look native to the feed", icon: "▣" },
  { title: "TikTok, Reels & Shorts", text: "9:16 vertical video ready", icon: "▯" },
  { title: "Multiple creator styles", text: "Different looks, niches and vibes", icon: "✦" },
  { title: "Product or website to video", text: "Full concept, script and scenes", icon: "↗" }
] as const;

function MetricIcon({ type }: { type: string }) {
  if (type === "people") {
    return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="16" cy="12" r="5"/><path d="M6 31c0-6 4-10 10-10s10 4 10 10"/><circle cx="29" cy="15" r="4"/><path d="M26 23c5 0 8 3 8 8"/></svg>;
  }
  if (type === "play") {
    return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14"/><path d="m17 13 10 7-10 7Z" className={styles.cutout}/></svg>;
  }
  if (type === "bolt") {
    return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M23 3 10 22h9l-2 15 14-21h-9Z"/></svg>;
  }
  return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="23" width="6" height="11" rx="2"/><rect x="17" y="15" width="6" height="19" rx="2"/><rect x="27" y="7" width="6" height="27" rx="2"/></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
}

function CreatorCard({ creator, onSelect }: { creator: CreatorMedia; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className={styles.creatorCard}>
      {!failed && creator.videoSrc ? (
        <video
          src={creator.videoSrc}
          muted
          playsInline
          loop
          preload="metadata"
          onError={() => setFailed(true)}
          aria-label={creator.name + " creator video"}
        />
      ) : (
        <div className={styles.videoPlaceholder}><span>{creator.name.slice(0, 1)}</span></div>
      )}
      <div className={styles.cardShade} />
      <button type="button" className={styles.cardPlay} onClick={onSelect} aria-label={"Show " + creator.name + " video"}><PlayIcon /></button>
      <div className={styles.creatorLabel}><b>{creator.name}</b><span>{creator.category}</span></div>
    </article>
  );
}

function ActivePhone({ media }: { media: CreatorMedia }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(24);

  useEffect(() => {
    setFailed(false);
    setElapsed(0);
    const video = ref.current;
    if (!video || !media.videoSrc) return;
    video.load();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPlaying(false);
      return;
    }
    video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [media.videoSrc]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true)).catch(() => undefined);
    else { video.pause(); setPlaying(false); }
  };

  const progress = duration > 0 ? Math.max(0, Math.min(100, elapsed / duration * 100)) : 0;

  return (
    <div className={styles.phone}>
      <div className={styles.phoneScreen}>
        {!failed && media.videoSrc ? (
          <video
            ref={ref}
            src={media.videoSrc}
            muted={muted}
            playsInline
            loop
            preload="metadata"
            onError={() => setFailed(true)}
            onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
            onLoadedMetadata={event => {
              const next = event.currentTarget.duration;
              if (Number.isFinite(next) && next > 0) setDuration(next);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            aria-label={media.name + " active creator video"}
          />
        ) : (
          <div className={styles.phonePlaceholder}><span>{media.name.slice(0, 1)}</span></div>
        )}
        <div className={styles.videoShade} />
        <div className={styles.generatedBadge}><span>✦</span> UGC GENERATED</div>
        <button type="button" className={styles.mute} onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute video" : "Mute video"}>
          {muted ? "⌁" : "◖"}
        </button>
        <div className={styles.identity}>
          <span className={styles.avatar}>{media.name.slice(0, 1)}</span>
          <span><b>{media.name}</b><small>{media.category}</small></span>
        </div>
        <div className={styles.progressRow}>
          <span className={styles.progressTrack}><i style={{ width: progress + "%" }} /></span>
          <small>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{Math.floor(elapsed % 60).toString().padStart(2, "0")} / {Math.floor(duration / 60).toString().padStart(2, "0")}:{Math.floor(duration % 60).toString().padStart(2, "0")}</small>
        </div>
        <button type="button" className={styles.pause} onClick={toggle} aria-label={playing ? "Pause video" : "Play video"}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
      </div>
    </div>
  );
}

export default function UgcAdStudioShowcase({ activeVideo, creators, createHref = "/portal/login.html?return=/app/ai-content-studio" }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);
  const sideCreators = useMemo(() => creators.slice(0, 4), [creators]);
  const current = selected === null ? activeVideo : sideCreators[selected] || activeVideo;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const choose = (index: number) => {
    setSelected(index);
    setPage(index);
  };

  return (
    <section ref={rootRef} className={styles.section + " " + (visible ? styles.visible : "")} aria-labelledby="ugc-showcase-title">
      <div className={styles.orbOne} aria-hidden="true" />
      <div className={styles.orbTwo} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>UGC AD STUDIO</span>
          <h2 id="ugc-showcase-title">Turn any idea into<br/><em>creator-style</em> videos</h2>
          <p>Choose from different creators, add your product or website, and let INXSocial generate high-converting UGC videos for TikTok, Reels and Shorts.</p>
          <a className={styles.cta} href={createHref}>Create a UGC Ad <span>→</span></a>
          <div className={styles.metrics}>
            {metrics.map(metric => (
              <article key={metric.label} className={styles.metric + " " + styles[metric.tone]}>
                <MetricIcon type={metric.icon} />
                <b>{metric.value}</b>
                <span>{metric.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.mediaColumn}>
          <div className={styles.mediaDesktop}>
            <div className={styles.sideRail}>
              {sideCreators.slice(0, 2).map((creator, index) => <CreatorCard key={creator.name} creator={creator} onSelect={() => choose(index)} />)}
            </div>
            <div className={styles.phoneColumn}>
              <ActivePhone media={current} />
              <div className={styles.carouselNav}>
                <button type="button" onClick={() => setPage((page + 3) % 4)} aria-label="Previous creator">‹</button>
                <div>{[0,1,2,3].map(index => <button key={index} type="button" className={index === page ? styles.activeDot : ""} onClick={() => { setPage(index); choose(index); }} aria-label={"Creator " + (index + 1)} />)}</div>
                <button type="button" onClick={() => setPage((page + 1) % 4)} aria-label="Next creator">›</button>
              </div>
            </div>
            <div className={styles.sideRail}>
              {sideCreators.slice(2, 4).map((creator, offset) => <CreatorCard key={creator.name} creator={creator} onSelect={() => choose(offset + 2)} />)}
            </div>
          </div>

          <div className={styles.mediaMobile}>
            <ActivePhone media={current} />
            <div className={styles.mobileRail}>
              {sideCreators.map((creator, index) => <CreatorCard key={creator.name} creator={creator} onSelect={() => choose(index)} />)}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.featureStrip}>
        {features.map(feature => (
          <article key={feature.title}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <span><b>{feature.title}</b><small>{feature.text}</small></span>
          </article>
        ))}
      </div>
    </section>
  );
}
