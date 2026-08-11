/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Darb palette — see design/stitch_heritage_landmark_guide/nocturne_heritage/DESIGN.md
        bg: '#0E0E12',
        surface: '#1A1A22',
        'surface-high': '#23232D',
        'surface-highest': '#2E2D38',
        accent: '#6C4BF4', // primary violet — interactive only
        'accent-soft': '#C9BEFF', // violet tint for text on dark
        sand: '#E4C89A', // heritage gold — scholarly metadata, distances
        muted: '#A0A0AE', // secondary text
        hairline: 'rgba(160, 160, 174, 0.2)', // ghost borders
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        label: ['"Space Grotesk"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        headline: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        body: ['16px', { lineHeight: '24px' }],
        caption: ['14px', { lineHeight: '20px' }],
        label: ['12px', { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '500' }],
      },
      borderRadius: {
        sheet: '20px', // cards + bottom sheets
        ctl: '16px', // buttons + inputs
      },
      spacing: {
        touch: '44px', // minimum touch target
        gutter: '20px', // mobile side margin
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
};
