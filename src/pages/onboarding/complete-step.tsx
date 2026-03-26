import { motion } from 'framer-motion'
import { CheckCircle2, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompleteStepProps {
  onLaunch: () => void
}

function CompleteStep({ onLaunch }: CompleteStepProps) {
  const items = [
    { label: 'Newton School MCP', done: true },
    { label: 'AI Provider configured', done: true },
    { label: 'Dashboard ready', done: true },
  ]

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
        className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-green-500/10"
      >
        <Rocket className="h-12 w-12 text-green-500" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
      <p className="text-[hsl(var(--muted-foreground))] max-w-md mb-8">
        Newton Companion is ready to help you succeed. Here's a summary of your setup:
      </p>

      <div className="w-full max-w-sm space-y-3 mb-10">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))] px-4 py-3"
          >
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </motion.div>
        ))}
      </div>

      <Button onClick={onLaunch} size="lg" className="gap-2">
        <Rocket className="h-4 w-4" />
        Launch Dashboard
      </Button>
    </motion.div>
  )
}

export { CompleteStep }
