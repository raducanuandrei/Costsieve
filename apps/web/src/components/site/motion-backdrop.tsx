import { useEffect, useRef, useState } from "react";

/**
 * Layered background: still image (always), optional looping video
 * (e.g. a Google Flow export) shown only when reduced motion is off.
 */
export function MotionBackdrop({ poster, videoSrc }: { poster: string; videoSrc?: string }) {
  const [allowMotion, setAllowMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (paused) video.current?.pause(); else void video.current?.play().catch(() => {}); }, [paused, allowMotion]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowMotion(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <><div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img src={poster} alt="" width={1920} height={1088} className="h-full w-full object-cover opacity-60" />
      {videoSrc && allowMotion && (
        <video ref={video} src={videoSrc} poster={poster} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-50" />
      )}
      <div className="absolute inset-0 bg-gridlines opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-fade" />
    </div>{videoSrc && allowMotion && <button type="button" className="absolute right-5 bottom-5 btn-3d-dark" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Play background' : 'Pause background'}</button>}</>
  );
}
