import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
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
    <div className="flex h-screen w-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="w-full max-w-xl px-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-8 bg-[hsl(var(--primary))]' : 'w-1.5 bg-[hsl(var(--muted))]',
                i < step && 'bg-[hsl(var(--primary))]/50'
              )}
            />
          ))}
        </div>

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
