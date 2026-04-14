import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { WelcomeStep } from './welcome-step'
import { McpConnectStep } from './mcp-connect-step'
import { CourseSelectStep } from './course-select-step'
import { AiBrainStep } from './ai-brain-step'
import { CompleteStep } from './complete-step'

interface OnboardingPageProps {
  onComplete: () => void
}

const TOTAL_STEPS = 5

function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(0)
  const [_selectedCourse, setSelectedCourse] = useState<{
    hash: string
    name: string
    semester: string | null
  } | null>(null)

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleCourseSelect = (hash: string, name: string, semester: string | null) => {
    setSelectedCourse({ hash, name, semester })
    next()
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center onboarding-bg relative overflow-hidden">
      {/* Ambient background orbs */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,199,206,0.08) 0%, transparent 70%)',
          top: '-120px',
          left: '20%',
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(126,154,207,0.07) 0%, transparent 70%)',
          bottom: '-80px',
          right: '15%',
        }}
      />

      <div className="relative w-full max-w-xl px-6">
        {/* Step indicator */}
        <motion.div
          className="flex items-center justify-center gap-2 mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full transition-all duration-500"
              style={{
                height: 4,
                width: i === step ? 28 : 8,
                background:
                  i === step
                    ? 'linear-gradient(90deg, #78C7CE, #7E9ACF)'
                    : i < step
                    ? 'rgba(120,199,206,0.4)'
                    : 'hsl(var(--muted))',
              }}
              layout
            />
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 0 && <WelcomeStep key="welcome" onNext={next} />}
          {step === 1 && <McpConnectStep key="mcp" onNext={next} onBack={back} />}
          {step === 2 && <CourseSelectStep key="course" onNext={handleCourseSelect} onBack={back} />}
          {step === 3 && <AiBrainStep key="ai" onNext={next} onBack={back} />}
          {step === 4 && <CompleteStep key="complete" onLaunch={onComplete} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

export { OnboardingPage }
