import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeStepProps {
  onNext: () => void
}

function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center"
    >
      {/* Hero logo icon with animated glow */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 180, damping: 14 }}
        className="relative mb-8"
      >
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: 'radial-gradient(circle, rgba(120,199,206,0.5) 0%, rgba(126,154,207,0.3) 50%, transparent 70%)',
            transform: 'scale(1.8)',
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <img
          src="/logo.png"
          alt="Newton"
          className="relative animate-float"
          style={{ width: 96, height: 96 }}
        />
      </motion.div>

      {/* Long-form wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mb-4"
      >
        <img
          src="/logo.svg"
          alt="Newton School"
          style={{
            height: 28,
            width: 'auto',
            filter: 'brightness(0) invert(0.9)',
            opacity: 0.85,
          }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.4 }}
        className="text-[28px] font-bold mb-3 tracking-tight"
      >
        Welcome to{' '}
        <span className="gradient-text">Newton Companion</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.48 }}
        className="text-[hsl(var(--muted-foreground))] text-[15px] max-w-sm mb-8 leading-relaxed"
      >
        Your AI-powered study companion — track lectures, manage assignments, practice problems, and get personalized help.
      </motion.p>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="flex flex-wrap justify-center gap-2.5 mb-10"
      >
        {[
          { label: 'Track Progress', color: 'rgba(120,199,206,0.15)', border: 'rgba(120,199,206,0.3)', text: '#78C7CE' },
          { label: 'AI Assistant',   color: 'rgba(126,154,207,0.15)', border: 'rgba(126,154,207,0.3)', text: '#7E9ACF' },
          { label: 'MCP Powered',    color: 'rgba(132,206,191,0.15)', border: 'rgba(132,206,191,0.3)', text: '#84CEBF' },
        ].map(({ label, color, border, text }) => (
          <span
            key={label}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
            style={{ background: color, border: `1px solid ${border}`, color: text }}
          >
            {label}
          </span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.62 }}
      >
        <Button
          onClick={onNext}
          size="lg"
          className="gap-2 px-8 font-semibold"
          style={{
            background: 'linear-gradient(135deg, #78C7CE 0%, #7E9ACF 100%)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(120,199,206,0.35)',
          }}
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  )
}

export { WelcomeStep }
