/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Console (dark dashboard) — unchanged ── */
        bg: {
          primary: '#05080D',
          panel: '#0A0F17',
          raised: '#0D131C',
        },
        border: {
          DEFAULT: '#1A2433',
          bright: '#2A3A52',
        },
        text: {
          primary: '#E6EDF5',
          secondary: '#7F8EA3',
          muted: '#4C5A6E',
        },
        accent: {
          cyan: '#F28C28',
          cyanDim: '#7A4A1B',
          amber: '#F0A93D',
          red: '#F0473D',
          green: '#3DE888',
          orange: '#E8792E',
        },

        /* ── Landing page (ChainGPT Labs dark charcoal #14161B + vivid orange) ── */
        'land-bg': '#14161B',
        land: {
          bg: '#14161B',
          surface: '#1B1E25',
          card: '#222630',
          panel: '#2A2F3B',
          border: '#2D323E',
          'border-bright': '#3E4554',
          capsule: '#F0F2F5',
          'capsule-shadow': '#D4D8E0',
          orange: '#FF6600',
          'orange-dark': '#E05500',
          'orange-light': 'rgba(255, 102, 0, 0.12)',
          'orange-glow': 'rgba(255, 102, 0, 0.35)',
          'text-primary': '#FFFFFF',
          'text-secondary': '#A2A8B5',
          'text-muted': '#6B7280',
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['0.75rem', { letterSpacing: '0.06em' }],
      },
      boxShadow: {
        /* Console shadows */
        panel: '0 0 0 1px rgba(26,36,51,0.8), 0 8px 24px rgba(0,0,0,0.45)',
        glowCyan: '0 0 12px rgba(242,140,40,0.35)',
        glowRed: '0 0 12px rgba(240,71,61,0.35)',
        glowAmber: '0 0 12px rgba(240,169,61,0.35)',
        glass: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        glassCyan: '0 0 0 1px rgba(242,140,40,0.18), 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(242,140,40,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
        
        /* Landing shadows (ChainGPT industrial style) */
        'land-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'land-card': '0 4px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
        'land-capsule': '0 25px 60px -12px rgba(0,0,0,0.7), 0 0 40px rgba(255,102,0,0.08)',
        'land-orange': '0 8px 24px rgba(255,102,0,0.35), 0 2px 6px rgba(255,102,0,0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        scan: 'scan 3s linear infinite',
        drift1: 'drift1 22s ease-in-out infinite',
        drift2: 'drift2 26s ease-in-out infinite',
        drift3: 'drift3 30s ease-in-out infinite',
        'bounce-slow': 'bounceSlow 2s ease-in-out infinite',
        'float-bubble': 'floatBubble 4s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        drift1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(6%, 8%) scale(1.15)' },
        },
        drift2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-8%, -4%) scale(1.1)' },
        },
        drift3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-5%, 7%) scale(1.2)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
        floatBubble: {
          '0%': { transform: 'translateY(100%) scale(0.8)', opacity: '0' },
          '50%': { opacity: '0.7' },
          '100%': { transform: 'translateY(-120%) scale(1.1)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
