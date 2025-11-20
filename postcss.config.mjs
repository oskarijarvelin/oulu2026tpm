/**
 * PostCSS Configuration
 * 
 * Määrittelee CSS:n käsittelyn Tailwind CSS:lle.
 * PostCSS käsittelee Tailwind-direktiivit ja muuntaa ne tavalliseksi CSS:ksi.
 */

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
