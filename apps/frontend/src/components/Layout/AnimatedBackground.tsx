/**
 * @file AnimatedBackground.tsx — Subtle moving colour-gradient background.
 *
 * Renders a set of softly blurred gradient "blobs" that slowly drift across
 * the main content area.  The effect is purely decorative and driven by CSS
 * animations so no JavaScript runs per-frame, keeping the performance impact
 * minimal.
 *
 * Behaviour:
 * - Enabled/disabled via `theme.backgroundAnimation.enabled`.
 * - Blob colours come from `theme.backgroundAnimation.palette.colors` for the
 *   default colour-mode and `theme.backgroundAnimation.presets[mode].colors`
 *   for the alternate mode.  When colours are not specified in the theme the
 *   component renders nothing.
 * - Animation speed and overall opacity are controlled by CSS custom
 *   properties (`--bg-anim-speed`, `--bg-anim-opacity`) injected by
 *   {@link injectCssVariables}.
 * - Respects the user's `prefers-reduced-motion` media query — the keyframe
 *   overrides in `index.css` collapse animation durations to near-zero when
 *   the preference is set.
 * - Positioned absolutely so it fills its nearest positioned ancestor without
 *   affecting layout.  The containing element in {@link AppLayout} uses
 *   `position: relative` and `overflow: hidden` to clip the blobs.
 */
import { useAppTheme } from '../../theme/app-theme-context';

/** CSS animation name to use for each blob index (0-based). */
const BLOB_ANIMATIONS = ['blobFloat0', 'blobFloat1', 'blobFloat2', 'blobFloat3'] as const;

/**
 * Percentage positions (left, top) for the initial centre of each blob so
 * they are spread across the viewport rather than piled on top of each other.
 */
const BLOB_POSITIONS: [number, number][] = [
  [15, 20],
  [75, 15],
  [60, 70],
  [20, 75],
];

/**
 * Renders the animated gradient background behind the main content area.
 * Returns `null` when the animation is disabled or no colours are configured.
 */
export default function AnimatedBackground() {
  const { theme, mode } = useAppTheme();
  const anim = theme.backgroundAnimation;

  if (!anim?.enabled) return null;

  const animPalette =
    mode !== theme.mode && anim.presets?.[mode] ? anim.presets[mode] : anim.palette;

  const colors = animPalette?.colors;
  if (!colors || colors.length === 0) return null;

  const speed = anim.speed ?? 20;
  const opacity = anim.opacity ?? 0.07;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {colors.map((color, index) => {
        const [left, top] = BLOB_POSITIONS[index % BLOB_POSITIONS.length];
        const animName = BLOB_ANIMATIONS[index % BLOB_ANIMATIONS.length];
        // Stagger each blob's start time so they don't all move in sync.
        const delay = -(index * (speed / colors.length));

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: '45vw',
              height: '45vw',
              maxWidth: '600px',
              maxHeight: '600px',
              borderRadius: '50%',
              background: color,
              opacity,
              filter: 'blur(80px)',
              transform: 'translate(-50%, -50%)',
              animation: `${animName} ${speed}s ease-in-out ${delay}s infinite`,
              willChange: 'transform',
            }}
          />
        );
      })}
    </div>
  );
}
