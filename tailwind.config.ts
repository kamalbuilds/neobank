import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#eaf0f8',
        muted: '#7a859c',
        bg: '#06070b',
        panel: 'rgba(255 255 255 / 0.028)',
        'panel-strong': 'rgba(255 255 255 / 0.05)',
        line: 'rgba(255 255 255 / 0.06)',
        'line-strong': 'rgba(255 255 255 / 0.12)',
        accent: '#2dd4bf',
        'accent-2': '#38bdf8',
        'accent-glow': 'rgba(45 212 191 / 0.35)',
        'accent-soft': 'rgba(45 212 191 / 0.08)',
        'accent-strong': 'rgba(45 212 191 / 0.18)',
        green: '#34d399',
        red: '#f87171',
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono-ui)', 'monospace'],
      },
      borderRadius: {
        lg: '20px',
        md: '14px',
        sm: '10px',
      },
      boxShadow: {
        'accent-glow': '0 8px 30px -12px rgba(45, 212, 191, 0.45)',
        'accent-glow-lg': '0 14px 36px -12px rgba(45, 212, 191, 0.7)',
        panel: '0 8px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.015) inset',
        modal: '0 30px 80px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.02) inset',
      },
      backgroundImage: {
        'vault-radial': 'radial-gradient(900px 500px at 82% -10%, rgba(45, 212, 191, 0.065), transparent 55%), radial-gradient(800px 450px at 5% 115%, rgba(56, 189, 248, 0.05), transparent 50%), linear-gradient(180deg, #04050a, #0a0c12 60%, #04050a)',
        'accent-gradient': 'linear-gradient(135deg, #2dd4bf, #38bdf8)',
        'accent-text': 'linear-gradient(100deg, #2dd4bf 5%, #5eead4 45%, #67e8f9 90%)',
      },
      fontSize: {
        'balance': ['clamp(40px, 5vw, 56px)', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '400' }],
      },
    },
  },
} satisfies Config
