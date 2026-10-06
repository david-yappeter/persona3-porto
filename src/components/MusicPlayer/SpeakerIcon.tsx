export const SpeakerIcon = ({ muted, size = 13 }: { muted: boolean; size?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
    {muted ? (
      <path d="M10.5 6.5l3 3M13.5 6.5l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    ) : (
      <>
        <path d="M10.5 6a3 3 0 010 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M12.5 4a6 6 0 010 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    )}
  </svg>
)
