import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
		"./index.html",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			// Font families
			fontFamily: {
				sans: ['Montserrat', 'system-ui', 'sans-serif'],
				heading: ['Raleway', 'system-ui', 'sans-serif'],
				montserrat: ['Montserrat', 'system-ui', 'sans-serif'],
				raleway: ['Raleway', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'monospace'],
			},

			// Typography - custom font sizes for fuel industry displays
			fontSize: {
				// Data display sizes
				'reading-sm': ['0.75rem', { lineHeight: '1rem' }],
				'reading': ['0.875rem', { lineHeight: '1.25rem' }],
				'reading-lg': ['1rem', { lineHeight: '1.5rem' }],
				'reading-xl': ['1.125rem', { lineHeight: '1.75rem' }],
				// Label sizes
				'label-xs': ['0.75rem', { lineHeight: '1rem' }],
				'label-sm': ['0.875rem', { lineHeight: '1.25rem' }],
				'label': ['1rem', { lineHeight: '1.5rem' }],
				'label-lg': ['1.125rem', { lineHeight: '1.75rem' }],
				// Heading sizes
				'heading-xs': ['0.875rem', { lineHeight: '1.25rem' }],
				'heading-sm': ['1rem', { lineHeight: '1.5rem' }],
				'heading': ['1.125rem', { lineHeight: '1.75rem' }],
				'heading-lg': ['1.25rem', { lineHeight: '1.75rem' }],
				'heading-xl': ['1.5rem', { lineHeight: '2rem' }],
				'heading-2xl': ['1.875rem', { lineHeight: '2.25rem' }],
				// Alert text sizes
				'alert-sm': ['0.75rem', { lineHeight: '1rem' }],
				'alert': ['0.875rem', { lineHeight: '1.25rem' }],
				'alert-lg': ['1rem', { lineHeight: '1.5rem' }],
			},

			colors: {
				// HSL-based semantic colors (shadcn/ui)
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: '#FEDF19',
					foreground: '#000000'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},

				// GSF Brand colors
				'gsf-green': '#008457',
				'gsf-gold': '#FEDF19',

				// Fuel status colors - CRITICAL for operational safety
				// Full palettes enable proper theming and dark mode
				'fuel-critical': {
					50: '#fef2f2',
					100: '#fee2e2',
					200: '#fecaca',
					300: '#fca5a5',
					400: '#f87171',
					500: '#ef4444',
					600: '#dc2626',
					700: '#b91c1c',
					800: '#991b1b',
					900: '#7f1d1d',
					950: '#450a0a',
					DEFAULT: '#dc2626'
				},
				'fuel-low': {
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f',
					950: '#451a03',
					DEFAULT: '#f59e0b'
				},
				'fuel-normal': {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					950: '#052e16',
					DEFAULT: '#16a34a'
				},
				'fuel-unknown': {
					50: '#f8fafc',
					100: '#f1f5f9',
					200: '#e2e8f0',
					300: '#cbd5e1',
					400: '#94a3b8',
					500: '#64748b',
					600: '#475569',
					700: '#334155',
					800: '#1e293b',
					900: '#0f172a',
					950: '#020617',
					DEFAULT: '#64748b'
				},

				// Alert colors with full palettes
				success: {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					DEFAULT: '#16a34a'
				},
				warning: {
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f',
					DEFAULT: '#f59e0b'
				},
				error: {
					50: '#fef2f2',
					100: '#fee2e2',
					200: '#fecaca',
					300: '#fca5a5',
					400: '#f87171',
					500: '#ef4444',
					600: '#dc2626',
					700: '#b91c1c',
					800: '#991b1b',
					900: '#7f1d1d',
					DEFAULT: '#dc2626'
				},

				// Glass effects for modern UI
				glass: {
					light: 'rgba(255, 255, 255, 0.1)',
					medium: 'rgba(255, 255, 255, 0.2)',
					dark: 'rgba(0, 0, 0, 0.1)',
					border: 'rgba(255, 255, 255, 0.18)'
				},

				// Legacy fuel colors (for backward compatibility)
				fuel: {
					critical: '#EF4444',
					warning: '#F59E0B',
					safe: '#10B981',
					empty: '#DC2626'
				},
			},

			// Background gradients
			backgroundImage: {
				'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
				'glass-gradient-dark': 'linear-gradient(135deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0))',
				'gradient-primary': 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
				'gradient-secondary': 'linear-gradient(135deg, #14B8A6, #06B6D4)',
				'gradient-accent': 'linear-gradient(135deg, #F59E0B, #FEDF19)',
				'gradient-professional': 'linear-gradient(135deg, #1e293b, #334155)',
				'gradient-slate': 'linear-gradient(135deg, #475569, #64748b)',
				'gradient-blue-subtle': 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
			},

			// Box shadows
			boxShadow: {
				'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
				'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
				'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
				'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
				'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
				'2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
				'3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.25)',
				'4xl': '0 45px 80px -15px rgba(0, 0, 0, 0.3)',
				'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
			},

			backdropBlur: {
				xs: '2px',
			},

			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},

			// Custom spacing
			spacing: {
				'18': '4.5rem',
				'88': '22rem',
				'128': '32rem',
			},

			// Keyframes for animations
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in-left': {
					'0%': { opacity: '0', transform: 'translateX(-20px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'slide-in-right': {
					'0%': { opacity: '0', transform: 'translateX(20px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'glow': {
					'0%, 100%': { boxShadow: '0 0 5px rgba(254, 223, 25, 0.5)' },
					'50%': { boxShadow: '0 0 20px rgba(254, 223, 25, 0.8)' }
				}
			},

			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'slide-in-left': 'slide-in-left 0.3s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'glow': 'glow 3s ease-in-out infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
