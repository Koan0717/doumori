import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        leaf: {
          50: '#f2faf3',
          100: '#dff3e2',
          200: '#b8e5c0',
          300: '#8ad196',
          400: '#5cb76c',
          500: '#3a9c4c',
          600: '#2b7d3b',
          700: '#256432',
          800: '#20502c',
          900: '#1b4225',
        },
      },
    },
  },
  plugins: [],
};

export default config;
