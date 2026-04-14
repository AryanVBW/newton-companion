import { useEffect } from 'react'
import {
  callNewtonTool,
  useNewtonData as useNewtonDataStoreHook,
  useNewtonDataStore,
} from '@/stores/newton-data-store'

export type NewtonData = ReturnType<typeof useNewtonDataStoreHook> & {
  callTool: typeof callNewtonTool
}

export function useNewtonData(courseHash?: string): NewtonData {
  const init = useNewtonDataStore((state) => state.init)
  const data = useNewtonDataStoreHook()

  void courseHash

  useEffect(() => {
    void init()
  }, [init])

  return {
    ...data,
    callTool: callNewtonTool,
  }
}
