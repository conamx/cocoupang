import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      maxWidth: {
        content: '1000px',
      },
      screens: {
        side: '1120px',
      },
    },
  },
  plugins: [],
} satisfies Config;
