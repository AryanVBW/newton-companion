import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Page = 'dashboard' | 'lectures' | 'assignments' | 'arena' | 'chat' | 'mcp-servers' | 'settings'
type Theme = 'dark' | 'light' | 'system'

interface UiState {
  currentPage: Page
  theme: Theme
  sidebarCollapsed: boolean
  onboardingComplete: boolean
  commandPaletteOpen: boolean
  selectedCourseHash: string | null
  selectedCourseName: string | null

  setCurrentPage: (page: Page) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  completeOnboarding: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setSelectedCourse: (hash: string, name: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentPage: 'dashboard',
      theme: 'dark',
      sidebarCollapsed: false,
      onboardingComplete: false,
      commandPaletteOpen: false,
      selectedCourseHash: null,
      selectedCourseName: null,

      setCurrentPage: (page) => set({ currentPage: page }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setSelectedCourse: (hash, name) => set({ selectedCourseHash: hash, selectedCourseName: name }),
    }),
    {
      name: 'newton-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        onboardingComplete: state.onboardingComplete,
        selectedCourseHash: state.selectedCourseHash,
        selectedCourseName: state.selectedCourseName,
      }),
    }
  )
)

export type { Page, Theme }
