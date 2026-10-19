/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Identitas PKTJ: biru tua korps + aksen kuning keselamatan
        pktj: {
          50:  '#eef4fb',
          100: '#d6e4f5',
          200: '#aec9eb',
          300: '#7ea7dc',
          400: '#4d80c6',
          500: '#2c60ab',
          600: '#1e488a',
          700: '#183a70',
          800: '#132e59',
          900: '#0e2242',
        },
        aksen: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
