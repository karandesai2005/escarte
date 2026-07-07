/**
 * Foxy — the SkillFox mascot for Escarté Learning Labs.
 * Humanoid stance • no mouth • expression lives in the eyes & brows.
 * Colors: burnt orange fur, warm cream, navy paws, amber-gold eyes.
 */
export default function Foxy({ mood = "neutral", size = 160, className = "" }) {
  const FUR = "#D4652A";
  const FUR_DARK = "#A8481A";
  const CREAM = "#F5F0E8";
  const NAVY = "#0A1628";
  const NAVY_MID = "#1B2A4A";
  const AMBER = "#C9A84C";
  const PUPIL = "#2D3436";

  // Expression variants — eyes + brows only
  const face = () => {
    if (mood === "sad") {
      // Concerned: wide soft eyes, inner brow tips raised
      return (
        <>
          <path d="M 70 80 L 84 76" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 130 80 L 116 76" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="78" cy="92" rx="6.5" ry="7.5" fill={CREAM} />
          <ellipse cx="122" cy="92" rx="6.5" ry="7.5" fill={CREAM} />
          <ellipse cx="78" cy="93" rx="5" ry="6" fill={AMBER} />
          <ellipse cx="122" cy="93" rx="5" ry="6" fill={AMBER} />
          <ellipse cx="78" cy="94" rx="2.2" ry="3" fill={PUPIL} />
          <ellipse cx="122" cy="94" rx="2.2" ry="3" fill={PUPIL} />
        </>
      );
    }
    if (mood === "happy" || mood === "cheer") {
      // Joyful crescents — closed happy eyes
      return (
        <>
          <path d="M 68 82 Q 78 86 88 82" stroke={NAVY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 132 82 Q 122 86 112 82" stroke={NAVY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 68 92 Q 78 82 88 92" stroke={PUPIL} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M 132 92 Q 122 82 112 92" stroke={PUPIL} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (mood === "thinking") {
      // Looking up-right, one brow raised
      return (
        <>
          <path d="M 68 76 L 88 74" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 112 76 Q 122 70 132 76" stroke={NAVY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="78" cy="92" rx="6" ry="7" fill={CREAM} />
          <ellipse cx="122" cy="92" rx="6" ry="7" fill={CREAM} />
          <ellipse cx="80" cy="90" rx="4.5" ry="5" fill={AMBER} />
          <ellipse cx="124" cy="90" rx="4.5" ry="5" fill={AMBER} />
          <ellipse cx="82" cy="88" rx="2" ry="2.5" fill={PUPIL} />
          <ellipse cx="126" cy="88" rx="2" ry="2.5" fill={PUPIL} />
        </>
      );
    }
    if (mood === "focused") {
      // Narrow direct stare, level brows
      return (
        <>
          <path d="M 68 78 L 88 78" stroke={NAVY} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M 112 78 L 132 78" stroke={NAVY} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M 68 90 Q 78 96 88 90" fill={AMBER} />
          <path d="M 132 90 Q 122 96 112 90" fill={AMBER} />
          <ellipse cx="78" cy="92" rx="2" ry="2.5" fill={PUPIL} />
          <ellipse cx="122" cy="92" rx="2" ry="2.5" fill={PUPIL} />
        </>
      );
    }
    // "Confident" default — one brow raised, half-squint
    return (
      <>
        <path d="M 68 78 Q 78 72 88 78" stroke={NAVY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 112 74 L 132 76" stroke={NAVY} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 68 90 Q 78 96 88 90 Q 78 84 68 90 Z" fill={CREAM} />
        <path d="M 112 90 Q 122 96 132 90 Q 122 84 112 90 Z" fill={CREAM} />
        <ellipse cx="78" cy="90" rx="5" ry="4.5" fill={AMBER} />
        <ellipse cx="122" cy="90" rx="5" ry="4.5" fill={AMBER} />
        <ellipse cx="79" cy="91" rx="2" ry="2.5" fill={PUPIL} />
        <ellipse cx="123" cy="91" rx="2" ry="2.5" fill={PUPIL} />
        <circle cx="80" cy="89" r="0.8" fill={CREAM} />
        <circle cx="124" cy="89" r="0.8" fill={CREAM} />
      </>
    );
  };

  const showGlasses = mood === "thinking";
  const showFlames = mood === "cheer";

  return (
    <div
      className={`inline-block ${mood === "cheer" ? "animate-pop" : ""} ${mood === "sad" ? "animate-shake" : ""} ${className}`}
      data-testid={`foxy-${mood}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 260" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="furGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FUR} />
            <stop offset="100%" stopColor={FUR_DARK} />
          </linearGradient>
          <linearGradient id="tailGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={FUR} />
            <stop offset="70%" stopColor={FUR} />
            <stop offset="100%" stopColor={CREAM} />
          </linearGradient>
          <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={FUR} />
            <stop offset="100%" stopColor={AMBER} />
          </linearGradient>
        </defs>

        {/* Abstract flame aura for cheer */}
        {showFlames && (
          <g className="animate-flicker" style={{ transformOrigin: "100px 130px" }}>
            <path d="M 40 130 Q 30 100 50 80 Q 45 105 60 115 Q 55 130 40 130 Z" fill="url(#flameGrad)" opacity="0.85" />
            <path d="M 160 130 Q 170 100 150 80 Q 155 105 140 115 Q 145 130 160 130 Z" fill="url(#flameGrad)" opacity="0.85" />
            <path d="M 100 30 Q 88 45 96 60 Q 100 50 104 60 Q 112 45 100 30 Z" fill="url(#flameGrad)" opacity="0.9" />
          </g>
        )}

        {/* Long fluffy tail — curling behind */}
        <path
          d="M 158 165 Q 195 145 190 105 Q 180 75 155 85 Q 170 110 165 140 Q 165 155 158 165 Z"
          fill="url(#tailGrad)"
          stroke={FUR_DARK}
          strokeWidth="1.5"
        />

        {/* Legs (navy paws) — slight cocked stance */}
        <path d="M 84 200 Q 82 230 78 245 L 96 245 L 96 205 Z" fill={FUR} />
        <path d="M 116 200 Q 118 232 122 245 L 104 245 L 104 205 Z" fill={FUR} />
        <ellipse cx="87" cy="248" rx="12" ry="5" fill={NAVY} />
        <ellipse cx="113" cy="248" rx="12" ry="5" fill={NAVY} />

        {/* Torso — lean humanoid */}
        <path d="M 76 145 Q 72 175 82 205 L 118 205 Q 128 175 124 145 Z" fill="url(#furGrad2)" />
        {/* Cream chest patch */}
        <path d="M 88 150 Q 84 180 92 200 L 108 200 Q 116 180 112 150 Z" fill={CREAM} />

        {/* Arms — one crossed loosely across chest (confident lean) */}
        <path d="M 76 148 Q 60 165 68 190 Q 75 185 82 178 Q 82 165 82 155 Z" fill={FUR} />
        <path d="M 124 148 Q 140 158 145 175 Q 130 178 118 175 Q 118 160 118 152 Z" fill={FUR} />
        {/* Paw tips */}
        <ellipse cx="66" cy="188" rx="7" ry="5" fill={NAVY} />
        <ellipse cx="143" cy="176" rx="7" ry="5" fill={NAVY} />

        {/* Navy bandana around neck */}
        <path d="M 78 140 Q 100 148 122 140 L 118 152 Q 100 158 82 152 Z" fill={NAVY_MID} />
        <path d="M 95 152 L 105 152 L 108 168 L 92 168 Z" fill={NAVY_MID} />
        {/* Bandana star pattern */}
        <circle cx="88" cy="146" r="1.5" fill={AMBER} />
        <circle cx="100" cy="149" r="1.5" fill={AMBER} />
        <circle cx="112" cy="146" r="1.5" fill={AMBER} />

        {/* Head — triangular tapered */}
        <path
          d="M 100 40 L 152 88 Q 148 130 130 138 Q 100 145 70 138 Q 52 130 48 88 Z"
          fill="url(#furGrad2)"
        />

        {/* Ears — one slightly folded */}
        <path d="M 52 78 L 46 30 L 78 62 Z" fill={FUR} />
        <path d="M 148 78 L 154 34 Q 145 42 138 55 L 122 62 Z" fill={FUR} />
        <path d="M 58 68 L 55 42 L 72 60 Z" fill={CREAM} />
        <path d="M 142 68 L 148 44 Q 143 50 138 58 Z" fill={CREAM} />

        {/* Cream face patch (cheeks / muzzle) */}
        <path d="M 100 88 L 138 108 L 128 132 Q 100 142 72 132 L 62 108 Z" fill={CREAM} />

        {/* Face — eyes / brows (no mouth) */}
        {face()}

        {/* Nose — small triangle */}
        <path d="M 95 108 L 105 108 L 100 116 Z" fill={NAVY} />

        {/* Gold hoop earring on left ear */}
        <circle cx="56" cy="72" r="3.5" fill="none" stroke={AMBER} strokeWidth="1.8" />

        {/* Optional glasses for thinking */}
        {showGlasses && (
          <>
            <circle cx="78" cy="92" r="10" fill="none" stroke={AMBER} strokeWidth="1.8" />
            <circle cx="122" cy="92" r="10" fill="none" stroke={AMBER} strokeWidth="1.8" />
            <line x1="88" y1="92" x2="112" y2="92" stroke={AMBER} strokeWidth="1.5" />
          </>
        )}

        {/* Subtle tear for sad */}
        {mood === "sad" && (
          <ellipse cx="72" cy="102" rx="2.5" ry="5.5" fill="#7BB4E3" />
        )}
      </svg>
    </div>
  );
}
