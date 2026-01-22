import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'var(--bg)',
  			foreground: 'var(--text)',
  			card: {
  				DEFAULT: 'var(--panel)',
  				foreground: 'var(--text)'
  			},
  			popover: {
  				DEFAULT: 'var(--panel)',
  				foreground: 'var(--text)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: '#0a0f14'
  			},
  			secondary: {
  				DEFAULT: 'var(--panel2)',
  				foreground: 'var(--text)'
  			},
  			muted: {
  				DEFAULT: 'var(--muted)',
  				foreground: 'var(--text)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--primary)'
  			},
  			destructive: {
  				DEFAULT: 'var(--error)',
  				foreground: 'var(--text)'
  			},
  			border: 'var(--border)',
  			input: 'var(--panel2)',
  			ring: 'var(--primary)',
  		},
  		borderRadius: {
  			lg: 'var(--radius-lg)',
  			md: 'var(--radius-md)',
  			sm: 'var(--radius-sm)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
