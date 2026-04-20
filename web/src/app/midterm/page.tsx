'use client'

/**
 * Midterm showcase page — single-page scrollable project demo site.
 *
 * Sections:
 *  1. Hero            – title, framing, CTAs
 *  2. Project Overview – what CO₂ Pomfret is, three feature cards
 *  3. Forest Demo      – embedded VectorForestDemo (interactive)
 *  4. Data Insights    – CarbonTrendChart + CarbonByPlotChart with year selector
 *  5. Screenshot Gallery – placeholder frames for screenshots
 *  6. Progress         – what's working vs. what's coming next
 *  7. Footer           – closing statement
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import CarbonTrendChart from '@/components/visualizations/CarbonTrendChart'
import CarbonByPlotChart from '@/components/visualizations/CarbonByPlotChart'
import {
  fetchVisualizationData,
  KEYFRAME_YEARS,
  type VisualizationData,
} from '@/lib/visualizationData'

// Load the forest demo client-only to avoid SSR issues with ResizeObserver
const VectorForestDemo = dynamic(
  () => import('@/components/midterm/VectorForestDemo'),
  { ssr: false },
)

// ── Scroll-based section visibility wrapper ───────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'forest-demo', label: 'Forest' },
  { id: 'insights', label: 'Data' },
  { id: 'gallery', label: 'Visuals' },
  { id: 'progress', label: 'Progress' },
]

// ── Screenshot placeholder card ───────────────────────────────────────────────

function ScreenshotSlot({
  label,
  caption,
  index,
}: {
  label: string
  caption: string
  index: number
}) {
  return (
    <FadeUp delay={index * 0.08}>
      <div
        className="group rounded-2xl overflow-hidden"
        style={{ border: '1.5px dashed #d1ddd4', background: '#f9fdfb' }}
      >
        {/* Placeholder image area */}
        <div
          className="aspect-video flex flex-col items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #f0f7f2 0%, #e8f5ec 100%)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#e0f0e6' }}
          >
            {/* Camera / image icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6bba8a"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <span className="text-xs font-medium" style={{ color: '#7aab8a' }}>
            Screenshot coming soon
          </span>
        </div>

        {/* Caption bar */}
        <div className="px-4 py-3" style={{ background: '#f4faf6' }}>
          <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            {caption}
          </p>
        </div>
      </div>
    </FadeUp>
  )
}

// ── Stat chip used in hero ────────────────────────────────────────────────────

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center px-5 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <span className="text-xl font-bold" style={{ color: '#4ade80' }}>
        {value}
      </span>
      <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
    </div>
  )
}

// ── Feature card for overview section ────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  body,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  body: string
  delay?: number
}) {
  return (
    <FadeUp delay={delay}>
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          background: 'white',
          border: '1px solid #e8f0eb',
          boxShadow: '0 2px 12px rgba(16,185,129,0.06)',
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}
        >
          {icon}
        </div>
        <h3
          className="text-base font-semibold mb-2"
          style={{ color: '#1e293b' }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
          {body}
        </p>
      </div>
    </FadeUp>
  )
}

// ── Progress item ─────────────────────────────────────────────────────────────

function ProgressItem({
  text,
  done,
}: {
  text: string
  done: boolean
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: done ? '#d1fae5' : '#f1f5f9',
        }}
      >
        {done ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6.5L5 9L9.5 3.5"
              stroke="#059669"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
            <circle cx="4" cy="4" r="3" stroke="#94a3b8" strokeWidth="1.2" />
          </svg>
        )}
      </span>
      <span
        className="text-sm leading-relaxed"
        style={{ color: done ? '#1e293b' : '#64748b' }}
      >
        {text}
      </span>
    </li>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MidtermPage() {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [vizData, setVizData] = useState<VisualizationData | null>(null)
  const [chartYear, setChartYear] = useState(0)
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState(false)

  // Fetch chart data on mount
  useEffect(() => {
    fetchVisualizationData('baseline')
      .then((data) => {
        setVizData(data)
        setChartLoading(false)
      })
      .catch(() => {
        setChartError(true)
        setChartLoading(false)
      })
  }, [])

  // Scroll listener: nav fade + active section tracking
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80)
      const pos = window.scrollY + 140
      let found = ''
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id)
        if (el && el.offsetTop <= pos) found = item.id
      }
      setActiveSection(found)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="relative" style={{ background: '#f0f7f2', minHeight: '100vh' }}>

      {/* ── Fixed scroll nav ─────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-[200] transition-all duration-400"
        style={{
          background: scrolled ? 'rgba(6, 22, 12, 0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
          pointerEvents: scrolled ? 'auto' : 'none',
          opacity: scrolled ? 1 : 0,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => scrollTo('hero')}
            className="text-sm font-semibold focus:outline-none"
            style={{ color: '#4ade80' }}
          >
            CO₂ Pomfret
          </button>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none"
                style={{
                  color:
                    activeSection === item.id
                      ? '#4ade80'
                      : 'rgba(255,255,255,0.55)',
                  background:
                    activeSection === item.id
                      ? 'rgba(74,222,128,0.1)'
                      : 'transparent',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium no-underline transition-colors"
            style={{
              background: 'rgba(74,222,128,0.15)',
              color: '#4ade80',
              border: '1px solid rgba(74,222,128,0.25)',
            }}
          >
            Full App →
          </Link>
        </div>
      </nav>

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
        style={{
          background:
            'linear-gradient(160deg, #061410 0%, #0d2218 45%, #122b1c 100%)',
        }}
      >
        {/* Subtle radial glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 60%, rgba(16,185,129,0.09) 0%, transparent 70%)',
          }}
        />

        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-8 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
          style={{
            background: 'rgba(74,222,128,0.12)',
            border: '1px solid rgba(74,222,128,0.25)',
            color: '#4ade80',
          }}
        >
          Midterm Progress Report — Spring 2026
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-center font-bold leading-none mb-6"
          style={{
            fontSize: 'clamp(3.5rem, 10vw, 7rem)',
            background:
              'linear-gradient(135deg, #ffffff 0%, #d1fae5 50%, #6ee7b7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          CO₂ Pomfret
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="text-center text-lg mb-4 max-w-xl"
          style={{ color: 'rgba(255,255,255,0.72)' }}
        >
          Forest Carbon Simulation &amp; Analysis
        </motion.p>

        {/* Framing line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="text-center text-sm mb-10 max-w-md"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          Tracking how Pomfret School&rsquo;s campus forest absorbs carbon
          over a simulated 20-year horizon — from raw tree measurements to
          interactive visualization.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-10"
        >
          <StatChip value="442" label="Trees measured" />
          <StatChip value="3" label="Forest plots" />
          <StatChip value="20 yr" label="Simulation horizon" />
          <StatChip value="~9.4" label="kg CO₂e / tree deviation" />
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <button
            onClick={() => scrollTo('forest-demo')}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none"
            style={{
              background: '#10b981',
              color: 'white',
              boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
            }}
          >
            Explore the Forest →
          </button>
          <button
            onClick={() => scrollTo('insights')}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            View Carbon Data
          </button>
        </motion.div>

        {/* Scroll down indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-10 flex flex-col items-center gap-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* ── 2. PROJECT OVERVIEW ──────────────────────────────────────────── */}
      <section
        id="overview"
        className="py-24 px-6"
        style={{ background: '#f0f7f2' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: '#10b981' }}
            >
              Project Overview
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ color: '#0f2d1a' }}
            >
              What is CO₂ Pomfret?
            </h2>
            <p
              className="text-base leading-relaxed max-w-2xl mb-14"
              style={{ color: '#4a6b56' }}
            >
              CO₂ Pomfret is a scientific and educational tool that models the
              carbon sequestration capacity of Pomfret School&rsquo;s campus
              forest. Starting from real field measurements of 442 trees across
              three forest plots, it simulates how the forest grows — and how
              much CO₂ it stores — over a 20-year horizon.
            </p>
          </FadeUp>

          <div className="grid sm:grid-cols-3 gap-5">
            <FeatureCard
              delay={0.1}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M12 22V12M12 12C12 12 7 9 7 4a5 5 0 0 1 10 0c0 5-5 8-5 8z" />
                </svg>
              }
              title="Field Data Collection"
              body="Every tree in the Pomfret forest was measured for species, plot location, and DBH (diameter at breast height). Carbon was then derived using standard allometric equations."
            />
            <FeatureCard
              delay={0.18}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-4 4 4 4-8" />
                </svg>
              }
              title="Growth Modeling"
              body="Species-specific baseline growth curves estimate how each tree's DBH changes year by year. A stochastic mode adds realistic natural variance to the projections."
            />
            <FeatureCard
              delay={0.26}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M12 2a10 10 0 1 0 10 10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
              title="Carbon Simulation"
              body="The app projects total forest carbon at key horizons (year 0, 5, 10, 20) and lets users explore how disturbances — fire, flood, invasive species — affect long-term sequestration."
            />
          </div>
        </div>
      </section>

      {/* ── 3. FOREST DEMO ───────────────────────────────────────────────── */}
      <section
        id="forest-demo"
        className="py-16 px-6"
        style={{ background: '#091a0e' }}
      >
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: '#4ade80' }}
            >
              Interactive Demo
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{ color: 'white' }}
            >
              Live Forest Visualization
            </h2>
            <p className="text-sm mb-8 max-w-xl" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Every tree is rendered from real field data. Drag the year slider to watch the
              forest grow. Click any tree to inspect its species, DBH, and estimated carbon.
              Use the scenario carousel to simulate disturbances.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <VectorForestDemo />
          </FadeUp>

          <FadeUp delay={0.15}>
            <p
              className="text-xs mt-5 text-center"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Real data from Pomfret School&rsquo;s forest baseline model ·{' '}
              442 trees across Upper, Middle, and Lower plots ·{' '}
              Requires the FastAPI backend running locally
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── 4. DATA INSIGHTS ─────────────────────────────────────────────── */}
      <section
        id="insights"
        className="py-24 px-6"
        style={{ background: 'white' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: '#10b981' }}
            >
              Data Insights
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{ color: '#0f2d1a' }}
            >
              Carbon Over Time
            </h2>
            <p className="text-sm mb-8 max-w-xl" style={{ color: '#64748b' }}>
              Live charts driven by the same backend that powers the full app.
              Select a snapshot year to see how carbon breaks down across the three plots.
            </p>
          </FadeUp>

          {/* Year selector pills */}
          <FadeUp delay={0.08}>
            <div className="flex flex-wrap gap-2 mb-8">
              {KEYFRAME_YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setChartYear(y)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none"
                  style={
                    chartYear === y
                      ? {
                          background: '#10b981',
                          color: 'white',
                          boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
                        }
                      : {
                          background: '#f0f7f2',
                          color: '#4a6b56',
                          border: '1px solid #d4e9db',
                        }
                  }
                >
                  Year {y}
                </button>
              ))}
            </div>
          </FadeUp>

          {chartLoading ? (
            <FadeUp delay={0.1}>
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{
                  height: 320,
                  background: '#f8fdf9',
                  border: '1px solid #e0f0e6',
                }}
              >
                <p className="text-sm animate-pulse" style={{ color: '#7aab8a' }}>
                  Loading chart data…
                </p>
              </div>
            </FadeUp>
          ) : chartError ? (
            <FadeUp delay={0.1}>
              <div
                className="rounded-2xl flex flex-col items-center justify-center gap-3 p-10 text-center"
                style={{
                  height: 280,
                  background: '#fffbf0',
                  border: '1px solid #fde68a',
                }}
              >
                <p className="text-sm font-medium" style={{ color: '#d97706' }}>
                  Charts require the backend
                </p>
                <p className="text-xs" style={{ color: '#92400e' }}>
                  Start the FastAPI server to load live carbon data.
                </p>
                <code
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#fef3c7', color: '#78350f' }}
                >
                  uvicorn src.api.app:app --reload
                </code>
              </div>
            </FadeUp>
          ) : vizData ? (
            <div className="grid lg:grid-cols-5 gap-5">
              {/* Carbon trend — hero chart */}
              <FadeUp delay={0.1} className="lg:col-span-3">
                <div
                  className="rounded-2xl p-6"
                  style={{
                    background: '#f8fdf9',
                    border: '1px solid #dff0e6',
                    boxShadow: '0 2px 16px rgba(16,185,129,0.06)',
                  }}
                >
                  <div className="mb-4">
                    <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>
                      Total Carbon Sequestered
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                      kg C across all plots · all 20 years
                    </p>
                  </div>
                  <CarbonTrendChart
                    timeSeries={vizData.timeSeries}
                    selectedYear={chartYear}
                    selectedPlot="all"
                    plots={vizData.plots}
                  />
                </div>
              </FadeUp>

              {/* Carbon by plot — supporting chart */}
              <FadeUp delay={0.18} className="lg:col-span-2">
                <div
                  className="rounded-2xl p-6 h-full"
                  style={{
                    background: '#f8fdf9',
                    border: '1px solid #dff0e6',
                    boxShadow: '0 2px 16px rgba(16,185,129,0.06)',
                  }}
                >
                  <div className="mb-4">
                    <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>
                      Carbon by Plot
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                      At year {chartYear}
                    </p>
                  </div>
                  <CarbonByPlotChart
                    snapshots={vizData.snapshots}
                    selectedYear={chartYear}
                    plots={vizData.plots}
                  />
                </div>
              </FadeUp>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── 5. SCREENSHOT GALLERY ────────────────────────────────────────── */}
      <section
        id="gallery"
        className="py-24 px-6"
        style={{ background: '#f4faf6' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: '#10b981' }}
            >
              Project Visuals
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{ color: '#0f2d1a' }}
            >
              Screenshots &amp; Demos
            </h2>
            <p className="text-sm mb-12 max-w-xl" style={{ color: '#4a6b56' }}>
              Visual documentation of the full application — screenshots to be
              added once the final design iteration is complete.
            </p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-5">
            <ScreenshotSlot
              index={0}
              label="Dashboard Overview"
              caption="Main dashboard with summary stats, carbon timeline, and year slider"
            />
            <ScreenshotSlot
              index={1}
              label="Vector Forest (Full App)"
              caption="Interactive 442-tree visualization with scenario simulation controls"
            />
            <ScreenshotSlot
              index={2}
              label="Visualization Suite"
              caption="Recharts-based dashboard: carbon trends, DBH distribution, radar chart"
            />
            <ScreenshotSlot
              index={3}
              label="Area Generalizer"
              caption="Tool for scaling forest carbon projections to non-Pomfret sites"
            />
          </div>
        </div>
      </section>

      {/* ── 6. PROGRESS ──────────────────────────────────────────────────── */}
      <section
        id="progress"
        className="py-24 px-6"
        style={{ background: '#f0f7f2' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: '#10b981' }}
            >
              Midterm Status
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{ color: '#0f2d1a' }}
            >
              Current Progress
            </h2>
            <p className="text-sm mb-12 max-w-xl" style={{ color: '#4a6b56' }}>
              A snapshot of what&rsquo;s fully working now, and what&rsquo;s on
              the near-term roadmap.
            </p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-8">
            {/* What's working */}
            <FadeUp delay={0.08}>
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'white',
                  border: '1px solid #d1fae5',
                  boxShadow: '0 2px 12px rgba(16,185,129,0.06)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: '#d1fae5' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm" style={{ color: '#065f46' }}>
                    What&rsquo;s Working
                  </h3>
                </div>
                <ul className="space-y-0.5">
                  {[
                    'Real tree data — 442 trees, 3 plots, 7 species',
                    'DBH growth model (baseline + stochastic mode)',
                    'Carbon estimation via allometric equations',
                    'Vector forest: interactive SVG visualization',
                    'Scenario simulations: fire, flood, tornado, invasive species',
                    'Multi-year snapshots (year 0, 5, 10, 20)',
                    'Recharts visualization dashboard (7 chart types)',
                    'FastAPI backend with live data endpoints',
                    'Area generalizer for non-Pomfret sites',
                  ].map((text) => (
                    <ProgressItem key={text} text={text} done />
                  ))}
                </ul>
              </div>
            </FadeUp>

            {/* Coming next */}
            <FadeUp delay={0.16}>
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: '#f1f5f9' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm" style={{ color: '#1e293b' }}>
                    Coming Next
                  </h3>
                </div>
                <ul className="space-y-0.5">
                  {[
                    'Species imagery for all 7 tree types in inspector',
                    'Neural network growth model (PyTorch, in progress)',
                    'Full app visual redesign (unified design system)',
                    'Export / sharing features for results',
                    'Additional disturbance scenario types',
                    'Comparison view between baseline and stochastic',
                    'Pomfret School emissions data integration',
                    'Print / presentation export mode',
                  ].map((text) => (
                    <ProgressItem key={text} text={text} done={false} />
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ────────────────────────────────────────────────────── */}
      <footer
        className="py-20 px-6"
        style={{
          background:
            'linear-gradient(160deg, #061410 0%, #0d2218 100%)',
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7 }}
          >
            <div
              className="text-3xl font-bold mb-4"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #6ee7b7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              CO₂ Pomfret
            </div>
            <p
              className="text-sm leading-relaxed max-w-xl mx-auto mb-10"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              An independent research project exploring the carbon sequestration
              potential of Pomfret School&rsquo;s campus forest — bridging real
              ecological field data with an interactive, educational interface.
            </p>

            <div
              className="flex flex-wrap items-center justify-center gap-6 mb-10 pt-8"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold no-underline transition-all"
                style={{
                  background: 'rgba(74,222,128,0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}
              >
                Launch Full App →
              </Link>
              <Link
                href="/vector-forest"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Vector Forest →
              </Link>
              <Link
                href="/visualizations"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Visualizations →
              </Link>
            </div>

            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Jay L. &nbsp;·&nbsp; Spring 2026 &nbsp;·&nbsp; Pomfret School
            </p>
          </motion.div>
        </div>
      </footer>
    </div>
  )
}
