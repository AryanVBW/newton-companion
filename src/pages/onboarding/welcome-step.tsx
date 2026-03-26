import { motion } from 'framer-motion'
import { GraduationCap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeStepProps {
  onNext: () => void
}

function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-[hsl(var(--primary))] shadow-lg shadow-purple-500/20"
      >
        <GraduationCap className="h-12 w-12 text-white" />
      </motion.div>

      <h1 className="text-3xl font-bold mb-3">Welcome to Newton Companion</h1>
      <p className="text-[hsl(var(--muted-foreground))] text-lg max-w-md mb-8">
        Your AI-powered study companion for Newton School. Track lectures, manage assignments, practice problems, and get personalized help.
      </p>

      <div className="flex gap-3 text-sm text-[hsl(var(--muted-foreground))] mb-10">
        <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] px-4 py-2">
          Track Progress
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] px-4 py-2">
          AI Assistant
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] px-4 py-2">
          MCP Powered
        </div>
      </div>

      <Button onClick={onNext} size="lg" className="gap-2">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

export { WelcomeStep }
