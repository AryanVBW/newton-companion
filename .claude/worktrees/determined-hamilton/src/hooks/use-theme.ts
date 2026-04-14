import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui-store'

export function useTheme() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => {
        root.classList.toggle('dark', mq.matches)
      }
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }

    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return { theme, setTheme }
}
