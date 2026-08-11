/**
 * OWNER: shared — the camera screen and the discovery nav both use it.
 *
 * The settings icon, defined once.
 *
 * It was a circle with eight detached spokes, drawn separately in two files.
 * At 20px those spokes read as a fuzzy asterisk rather than a gear, and two
 * copies of an icon drift apart the first time somebody adjusts one.
 *
 * Sliders instead: three tracks with a knob at a different position on each.
 * It stays legible at 20px because there are only six strokes, it fits the
 * geometric line language of the rest of the interface, and it describes what
 * is actually behind the button — a language toggle, a voice choice and a
 * speed slider. Nothing in it is directional, so it needs no RTL mirroring.
 */

export default function SettingsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      {/* Each track breaks around its knob, so the knob stays a clean circle
          instead of a ring with a line through it. */}
      <path d="M4 6.5H7.1M13.9 6.5H20" />
      <circle cx="10.5" cy="6.5" r="2.1" />

      <path d="M4 12H10.1M16.9 12H20" />
      <circle cx="13.5" cy="12" r="2.1" />

      <path d="M4 17.5H6.1M12.9 17.5H20" />
      <circle cx="9.5" cy="17.5" r="2.1" />
    </svg>
  );
}
