/**
 * OWNER: teammate A (T-8, T-9, T-10, T-21, T-29).
 *
 * DONE:  live rear camera via getUserMedia, frame capture to a compressed
 *        JPEG, tracks stopped on unmount, permission-repair message with an
 *        upload fallback, location read once on mount with a status pill,
 *        and the processing state over the frozen frame.
 * TODO:  1. Frame quality check — reject blurred or dark frames before
 *           spending a model call on them (T-9).
 *        2. The permission primer from design/permissions_access, shown
 *           before the browser's own prompt.
 *        3. Manual district selection when location is denied. Today a denied
 *           fix falls back to the whole library with a caveat, which is the
 *           behaviour the PRD asks for but not yet the UI.
 *
 * RULE 3 lives in resolve(): match_id === null goes to /not-found, and nothing
 * about the building travels with it beyond the elements we saw.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusIndicator from '../components/StatusIndicator';
import { useLang } from '../lib/i18n';
import { isRecognisable, loadLandmarks, selectCandidates } from '../lib/library';
import { getPosition } from '../lib/location';
import { recognize } from '../lib/recognize';
import type { Capture, Stage } from '../lib/types';

/** Longest edge of a captured frame, in pixels. */
const MAX_EDGE = 1280;
/** JPEG quality for captured frames. */
const JPEG_QUALITY = 0.8;
/** Radius we narrow candidates to when we know where the user is. */
const CANDIDATE_RADIUS_KM = 1;

type CameraStatus =
  | { state: 'starting' }
  | { state: 'live' }
  /** The user refused, or the browser blocked us. */
  | { state: 'denied' }
  /** No camera on this device. */
  | { state: 'none' }
  /** Page is not on HTTPS, so the camera API does not exist at all. */
  | { state: 'insecure' }
  | { state: 'error'; detail: string };

type LocationStatus =
  | { state: 'acquiring' }
  | { state: 'acquired'; lat: number; lng: number; accuracy: number }
  | { state: 'denied' }
  | { state: 'unavailable' };

/**
 * Draws a video frame or an image onto a canvas, shrinking it so its longest
 * edge is at most MAX_EDGE, and returns it as a compressed JPEG data URL.
 *
 * Shrinking happens before upload because a full-resolution phone photo is
 * several megabytes, and on mobile data that is the difference between a
 * 2-second answer and a 12-second one.
 */
function toCompressedJpeg(
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context.');
  ctx.drawImage(source, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Reads a chosen file into the same compressed-JPEG shape as a live capture. */
function fileToCompressedJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(toCompressedJpeg(img, img.naturalWidth, img.naturalHeight));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

// ── Icons ───────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none"
         stroke="currentColor" strokeWidth="1.75">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none"
         stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </svg>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

/** Location status pill. Never blocks anything — it only reports. */
function LocationPill({ status }: { status: LocationStatus }) {
  const { t } = useLang();
  const text =
    status.state === 'acquiring'
      ? t('locating')
      : status.state === 'acquired'
        ? `±${Math.round(status.accuracy)} m`
        : status.state === 'denied'
          ? t('locationOff')
          : t('noFix');

  const tone =
    status.state === 'acquired'
      ? 'text-white'
      : status.state === 'acquiring'
        ? 'text-muted'
        : 'text-sand';

  return (
    <span className={`glass flex h-touch items-center gap-2 rounded-full px-4 ${tone}`}>
      <PinIcon />
      <span className="label-caps">{text}</span>
    </span>
  );
}

/** The four corner brackets that frame the subject. */
function FramingGuides() {
  const corner = 'absolute h-10 w-10 border-white/70';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-12 top-1/3 h-64">
      <span className={`${corner} start-0 top-0 border-s-2 border-t-2`} />
      <span className={`${corner} end-0 top-0 border-e-2 border-t-2`} />
      <span className={`${corner} bottom-0 start-0 border-b-2 border-s-2`} />
      <span className={`${corner} bottom-0 end-0 border-b-2 border-e-2`} />
    </div>
  );
}

/**
 * Shown instead of the viewfinder when the camera cannot start. Always offers
 * a way forward — a blocked camera is not a dead end.
 */
function CameraFallback({
  status,
  onFile,
}: {
  status: CameraStatus;
  onFile: (file: File) => void;
}) {
  const { t } = useLang();
  const message =
    status.state === 'denied'
      ? { title: t('cameraBlockedTitle'), body: t('cameraBlockedBody') }
      : status.state === 'none'
        ? { title: t('cameraNoneTitle'), body: t('cameraNoneBody') }
        : status.state === 'insecure'
          ? { title: t('cameraInsecureTitle'), body: t('cameraInsecureBody') }
          : {
              title: t('cameraErrorTitle'),
              body: status.state === 'error' ? status.detail : t('cameraErrorBody'),
            };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-bg px-gutter text-center">
      <h2 className="text-headline text-white">{message.title}</h2>
      <p className="mb-2 text-body text-muted">{message.body}</p>

      <label
        className="flex h-14 w-full max-w-xs cursor-pointer items-center justify-center rounded-ctl
                   bg-accent text-body-lg font-semibold text-white"
      >
        {t('choosePhoto')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CameraPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Set when the user cancels, so a resolving request stops navigating. */
  const abandonedRef = useRef(false);

  const [camera, setCamera] = useState<CameraStatus>({ state: 'starting' });
  const [location, setLocation] = useState<LocationStatus>({ state: 'acquiring' });
  const [stage, setStage] = useState<Stage | null>(null);
  /** The frozen frame shown behind the status indicator while we resolve it. */
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);

  // ── Camera lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function start() {
      // On plain http (other than localhost) the browser does not expose
      // mediaDevices at all, so this is a missing API rather than a refusal.
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera({ state: 'insecure' });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        // The component may have unmounted while the user was deciding. If we
        // do not stop the stream here, the camera light stays on with nothing
        // rendering it.
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Safari needs an explicit play() even with the autoPlay attribute.
          await videoRef.current.play().catch(() => undefined);
        }
        setCamera({ state: 'live' });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setCamera({ state: 'denied' });
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setCamera({ state: 'none' });
        } else {
          setCamera({
            state: 'error',
            detail: err instanceof Error ? err.message : 'Unknown camera error.',
          });
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      // Leaving the page must release the camera. Without this the indicator
      // light stays on and the next getUserMedia can fail on some devices.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // ── Location, once on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    void getPosition().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLocation({
          state: 'acquired',
          lat: result.lat,
          lng: result.lng,
          accuracy: result.accuracy,
        });
      } else {
        setLocation({ state: result.error === 'denied' ? 'denied' : 'unavailable' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Runs a captured frame through recognition and routes on the answer.
   * The frame travels to whichever screen resolves it, so both can show it.
   */
  const resolve = useCallback(
    async (image: string) => {
      abandonedRef.current = false;
      setFrozenFrame(image);
      setStage('locating');

      const capture: Capture = {
        image,
        lat: location.state === 'acquired' ? location.lat : null,
        lng: location.state === 'acquired' ? location.lng : null,
        accuracy: location.state === 'acquired' ? location.accuracy : null,
        locationDenied: location.state === 'denied',
      };

      try {
        const library = await loadLandmarks();

        // With a fix we narrow to what is actually nearby. Without one we fall
        // back to the whole library rather than guessing a position — fewer
        // candidates chosen from the wrong place is worse than more from the
        // right one.
        // Either way, only entries we can actually identify are offered —
        // see isRecognisable() in library.ts for why that matters.
        const candidate_ids =
          capture.lat !== null && capture.lng !== null
            ? selectCandidates(library, capture.lat, capture.lng, CANDIDATE_RADIUS_KM)
            : library.filter(isRecognisable).map((l) => l.id);

        if (abandonedRef.current) return;
        setStage('matching');

        const result = await recognize({
          frame: capture.image,
          origin: capture.lat !== null && capture.lng !== null
            ? { lat: capture.lat, lng: capture.lng }
            : null,
          candidate_ids,
        });

        if (abandonedRef.current) return;
        setStage('fetching');

        // ── RULE 3 ──────────────────────────────────────────────────────────
        // No match means no name, no date, no story. Honest mode gets the
        // frame and the elements we saw — no landmark id, no candidate list.
        if (result.match_id === null) {
          navigate('/not-found', {
            state: { capture, elements_seen: result.elements_seen },
          });
          return;
        }

        navigate(`/story/${result.match_id}`, { state: { capture } });
      } catch (err) {
        if (abandonedRef.current) return;
        // TODO(A): distinct messages for timeout / no candidates / network,
        // each offering a next step (Epic 5). Never a silent stall.
        console.error('Recognition failed:', err);
        setStage(null);
        setFrozenFrame(null);
      }
    },
    [location, navigate],
  );

  /** Grabs the current video frame and sends it to be resolved. */
  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    void resolve(toCompressedJpeg(video, video.videoWidth, video.videoHeight));
  }

  /** Same path, but the frame came from the file picker. */
  async function handleFile(file: File) {
    try {
      void resolve(await fileToCompressedJpeg(file));
    } catch (err) {
      console.error('Could not read that image:', err);
    }
  }

  function handleCancel() {
    abandonedRef.current = true;
    setStage(null);
    setFrozenFrame(null);
  }

  const showViewfinder = camera.state === 'starting' || camera.state === 'live';

  return (
    <div className="relative h-full w-full bg-bg">
      {/* Live camera — the page background. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {showViewfinder && <FramingGuides />}

      {camera.state !== 'starting' && camera.state !== 'live' && (
        <CameraFallback status={camera} onFile={handleFile} />
      )}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-gutter">
        <LocationPill status={location} />
        <button
          type="button"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          aria-label={t('language')}
          className="control glass text-white label-caps"
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {showViewfinder && (
        <>
          <p className="absolute inset-x-0 bottom-40 z-10 mx-auto w-fit rounded-ctl bg-black/40 px-5 py-3
                        text-body-lg text-white backdrop-blur-glass">
            {t('pointAtLandmark')}
          </p>

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between p-gutter pb-8">
            <button
              type="button"
              onClick={() => navigate('/discover')}
              aria-label={t('discoverNearby')}
              className="control glass text-white"
            >
              <MapIcon />
            </button>

            <button
              type="button"
              onClick={handleCapture}
              disabled={camera.state !== 'live' || stage !== null}
              aria-label={t('capture')}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4
                         border-white/90 transition-transform active:scale-95 disabled:opacity-60"
            >
              <span className="h-[58px] w-[58px] rounded-full bg-accent" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label={t('settings')}
              className="control glass text-white"
            >
              <GearIcon />
            </button>
          </div>
        </>
      )}

      {/* Processing: the frozen frame, dimmed, with the status indicator over it. */}
      {stage && frozenFrame && (
        <div className="absolute inset-0 z-30">
          <img src={frozenFrame} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-glass" />
          <StatusIndicator stage={stage} onCancel={handleCancel} lang={lang} />
        </div>
      )}
    </div>
  );
}
