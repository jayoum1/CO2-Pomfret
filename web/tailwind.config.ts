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
  				DEFAULT: 'var(--surface)',
  				foreground: 'var(--text)'
  			},
  			popover: {
  				DEFAULT: 'var(--surface)',
  				foreground: 'var(--text)'
  			},
  			primary: {
  				DEFAULT: 'var(--primary)',
  				foreground: '#ffffff'
  			},
  			secondary: {
  				DEFAULT: 'var(--surface-2)',
  				foreground: 'var(--text)'
  			},
  			muted: {
  				DEFAULT: 'var(--surface-2)',
  				foreground: 'var(--text-muted)'
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'var(--primary)'
  			},
  			destructive: {
  				DEFAULT: 'var(--error)',
  				foreground: '#ffffff'
  			},
  			border: 'var(--border)',
  			input: 'var(--surface)',
  			ring: 'var(--primary)',
  			/* Chart tokens — usable as bg-chart-1 etc. */
  			'chart-1': 'var(--chart-1)',
  			'chart-2': 'var(--chart-2)',
  			'chart-3': 'var(--chart-3)',
  			'chart-4': 'var(--chart-4)',
  			'chart-5': 'var(--chart-5)',
  		},
  		borderRadius: {
  			/* Wired to the design-system tokens defined in globals.css :root */
  			panel:   'var(--radius-panel)',    /* 20px — large containers     */
  			card:    'var(--radius-card)',     /* 12px — standard cards       */
  			control: 'var(--radius-control)', /* 6px  — buttons, inputs      */
  			pill:    'var(--radius-pill)',     /* 4px  — badges, chips        */
  			/* Keep Tailwind's built-in shorthands pointing at sensible values */
  			lg: 'var(--radius-card)',
  			md: 'var(--radius-control)',
  			sm: 'var(--radius-pill)',
  		},
  		fontSize: {
  			'page-title':    ['var(--font-size-page)',    { fontWeight: '700', lineHeight: '1.25' }],
  			'section-title': ['var(--font-size-section)', { fontWeight: '600', lineHeight: '1.35' }],
  			'card-title':    ['var(--font-size-card)',    { fontWeight: '600', lineHeight: '1.4'  }],
  			'body':          ['var(--font-size-body)',    { fontWeight: '400', lineHeight: '1.6'  }],
  			'meta':          ['var(--font-size-meta)',    { fontWeight: '400', lineHeight: '1.5'  }],
  			'label':         ['var(--font-size-label)',   { fontWeight: '500', lineHeight: '1.4'  }],
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
