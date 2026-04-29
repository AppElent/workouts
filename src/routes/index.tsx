import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IntroPage,
});

function IntroPage() {
  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* Green glow blobs — CSS only, no JS */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(29,185,84,0.12), transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, rgba(29,185,84,0.06), transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top navigation */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-[30px] h-[30px] rounded-[6px] flex items-center justify-center font-black text-black text-[15px]"
            style={{ background: '#1DB954' }}
          >
            W
          </div>
          <span className="text-white font-bold text-sm">Workout Tracker</span>
        </div>

        <nav className="hidden sm:flex items-center gap-6">
          {[
            { to: '/exercises', label: 'Exercises' },
            { to: '/progress', label: 'Progress' },
            { to: '/routines', label: 'Routines' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-[#b3b3b3] hover:text-white transition-colors"
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1.2px',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Hero — anchored to bottom */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-12 sm:px-12">
        <p
          className="mb-3"
          style={{
            color: '#1DB954',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}
        >
          Your gym. Your data.
        </p>

        <h1 className="mb-4" style={{ lineHeight: 1.05, letterSpacing: '-1.5px' }}>
          <span className="block text-white" style={{ fontSize: 52, fontWeight: 900 }}>
            Track every lift.
          </span>
          <span className="block" style={{ fontSize: 52, fontWeight: 900, color: '#1DB954' }}>
            Own every PR.
          </span>
        </h1>

        <p
          className="mb-8 max-w-[420px]"
          style={{ color: '#b3b3b3', fontSize: 15, lineHeight: 1.6 }}
        >
          Log sets, track 1RMs, and watch your strength compound — session by session.
        </p>

        <div className="flex items-center gap-6 flex-wrap">
          <Link
            to="/log"
            className="px-8 py-3 font-bold text-black text-sm transition-colors"
            style={{
              background: '#1DB954',
              borderRadius: 50,
              fontWeight: 700,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#1ed760';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#1DB954';
            }}
          >
            Start Workout
          </Link>
          <Link
            to="/exercises"
            className="text-sm transition-colors"
            style={{ color: '#b3b3b3' }}
          >
            Browse exercises{' '}
            <span style={{ color: '#1DB954' }}>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
