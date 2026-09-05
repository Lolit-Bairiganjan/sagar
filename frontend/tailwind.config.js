/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['0.75rem', { letterSpacing: '0.06em' }],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(26,36,51,0.8), 0 8px 24px rgba(0,0,0,0.45)',
        glowCyan: '0 0 12px rgba(242,140,40,0.35)',
        glowRed: '0 0 12px rgba(240,71,61,0.35)',
        glowAmber: '0 0 12px rgba(240,169,61,0.35)',
        glass: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        glassCyan: '0 0 0 1px rgba(242,140,40,0.18), 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(242,140,40,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
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
      },
    },
  },
  plugins: [],
};
