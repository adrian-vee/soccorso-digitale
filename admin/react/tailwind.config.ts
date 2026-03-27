import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sd: {
          primary:    '#1E3A8A',
          amber:      '#F59E0B',
          'accent-bg':'#DBEAFE',
          bg:         '#F0F4FF',
          text:       '#0C1A2E',
          muted:      '#64748B',
          border:     '#E2E8F0',
          success:    '#10B981',
          danger:     '#EF4444',
          white:      '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
