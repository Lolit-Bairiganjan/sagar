export default function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="ambient-orb animate-drift1"
        style={{
          top: '-10%',
          left: '5%',
          width: '38vw',
          height: '38vw',
          background: 'radial-gradient(circle, rgba(242,140,40,0.55) 0%, rgba(242,140,40,0) 70%)',
        }}
      />
      <div
        className="ambient-orb animate-drift2"
        style={{
          bottom: '-15%',
          right: '0%',
          width: '32vw',
          height: '32vw',
          background: 'radial-gradient(circle, rgba(240,71,61,0.35) 0%, rgba(240,71,61,0) 70%)',
        }}
      />
      <div
        className="ambient-orb animate-drift3"
        style={{
          top: '30%',
          right: '20%',
          width: '26vw',
          height: '26vw',
          background: 'radial-gradient(circle, rgba(240,169,61,0.28) 0%, rgba(240,169,61,0) 70%)',
        }}
      />
      <div className="absolute inset-0 bg-bg-primary/40" />
    </div>
  );
}
