import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone, ArrowRight, ArrowLeft, CheckCircle2, Loader2,
  Wifi, WifiOff, Package, LogIn, User, Database, Copy, ExternalLink, X,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNewtonAuthStore } from '@/stores/newton-auth-store'

interface McpConnectStepProps {
  onNext: () => void
  onBack: () => void
}

function McpConnectStep({ onNext, onBack }: McpConnectStepProps) {
  const connectStatus = useNewtonAuthStore((s) => s.connectStatus)
  const connectError = useNewtonAuthStore((s) => s.connectError)
  const deviceCode = useNewtonAuthStore((s) => s.deviceCode)
  const deviceUrl = useNewtonAuthStore((s) => s.deviceUrl)
  const terminalLines = useNewtonAuthStore((s) => s.terminalLines)
  const userName = useNewtonAuthStore((s) => s.userName)
  const userEmail = useNewtonAuthStore((s) => s.userEmail)
  const fullConnect = useNewtonAuthStore((s) => s.fullConnect)
  const startLogin = useNewtonAuthStore((s) => s.startLogin)
  const cancelLogin = useNewtonAuthStore((s) => s.cancelLogin)
  const [copied, setCopied] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Kick off the full check → connect flow on mount
  useEffect(() => {
    if (connectStatus === 'idle') {
      fullConnect()
    }
  }, [fullConnect, connectStatus])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  const status = connectStatus

  const copyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
        <Smartphone className="h-8 w-8 text-blue-500" />
      </div>

      <h2 className="text-2xl font-bold mb-2">Link Your Account</h2>
      <p className="text-[hsl(var(--muted-foreground))] max-w-md mb-8">
        Sign in to your Newton School account to sync your real course data, lectures, and assignments.
      </p>

      {/* Checking / Installing MCP */}
      {(status === 'checking_mcp' || status === 'installing_mcp') && (
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">
                {status === 'checking_mcp' ? 'Checking Newton MCP...' : 'Setting up Newton MCP...'}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {status === 'checking_mcp'
                  ? 'Looking for @newtonschool/newton-mcp'
                  : 'Installing @newtonschool/newton-mcp'}
              </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        </div>
      )}

      {/* Not logged in — show Sign In button */}
      {status === 'not_logged_in' && (
        <div className="w-full max-w-md mb-8 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-500 font-medium">Newton MCP ready</span>
          </div>

          <Button
            onClick={startLogin}
            size="lg"
            className="w-full gap-2 h-12 text-base"
          >
            <LogIn className="h-5 w-5" />
            Sign in to Newton School
          </Button>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            This will open your browser to sign in with your Newton School account.
          </p>
        </div>
      )}

      {/* Starting login — show terminal output */}
      {status === 'starting_login' && (
        <div className="w-full max-w-md mb-8 space-y-3">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Starting login process...
          </div>

          {/* Terminal view */}
          {terminalLines && terminalLines.length > 0 && (
            <div
              ref={terminalRef}
              className="w-full rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] p-3 text-left max-h-32 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2a2a4a]">
                <Terminal className="h-3 w-3 text-green-400" />
                <span className="text-[10px] font-mono text-green-400">newton-mcp login</span>
              </div>
              {terminalLines.map((line, i) => (
                <p key={i} className="text-xs font-mono text-gray-300 leading-5">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waiting for auth — device code + terminal */}
      {status === 'waiting_for_auth' && (
        <div className="w-full max-w-md mb-8 space-y-4">
          {/* Device code — big and prominent */}
          <div className="p-5 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">
              Enter this code on the activation page:
            </p>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="font-mono text-4xl font-black tracking-[0.3em] text-[hsl(var(--foreground))] bg-[hsl(var(--card))] px-6 py-3 rounded-lg border border-[hsl(var(--border))] select-all">
                {deviceCode}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyCode}
                className="gap-1.5"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>

              {deviceUrl && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(deviceUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Activation Page
                </Button>
              )}
            </div>
          </div>

          {/* Terminal output */}
          {terminalLines && terminalLines.length > 0 && (
            <div
              ref={terminalRef}
              className="w-full rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] p-3 text-left max-h-36 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2a2a4a]">
                <Terminal className="h-3 w-3 text-green-400" />
                <span className="text-[10px] font-mono text-green-400">newton-mcp login</span>
              </div>
              {terminalLines.map((line, i) => (
                <p key={i} className="text-xs font-mono text-gray-300 leading-5">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for you to authorize on the web...
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[hsl(var(--muted-foreground))] mx-auto"
            onClick={cancelLogin}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      )}

      {/* Starting MCP server */}
      {status === 'starting_server' && (
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">Starting Newton MCP server...</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Connecting to your account</p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          </div>
        </div>
      )}

      {/* Fetching profile */}
      {status === 'fetching_profile' && (
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <User className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">Fetching your data...</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading your Newton School profile</p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          </div>
        </div>
      )}

      {/* Connected — show user info + Continue */}
      {status === 'connected' && (
        <div className="w-full max-w-md mb-8">
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-green-500/20 bg-green-500/5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
              <Wifi className="h-7 w-7 text-green-500" />
            </div>

            <div>
              <p className="text-lg font-semibold text-green-500">Account Connected!</p>
              {userName && (
                <p className="text-sm text-[hsl(var(--foreground))] mt-1">
                  Welcome, <span className="font-semibold">{userName}</span>
                </p>
              )}
              {userEmail && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {userEmail}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Data synced successfully
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="w-full max-w-md mb-8 space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <WifiOff className="h-5 w-5 text-red-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-red-500">Connection failed</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {connectError || 'Could not connect. Please try again.'}
              </p>
            </div>
          </div>

          {/* Show terminal output on error too */}
          {terminalLines && terminalLines.length > 0 && (
            <div className="w-full rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] p-3 text-left max-h-28 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2a2a4a]">
                <Terminal className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-mono text-red-400">error output</span>
              </div>
              {terminalLines.map((line, i) => (
                <p key={i} className="text-xs font-mono text-gray-400 leading-5">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => fullConnect()} variant="outline" className="flex-1 gap-2">
              Try Again
            </Button>
            <Button onClick={startLogin} variant="outline" className="flex-1 gap-2">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {status === 'connected' ? (
          <Button onClick={onNext} className="gap-2">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <button
            onClick={onNext}
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer px-4 py-2"
          >
            Skip for now
          </button>
        )}
      </div>
    </motion.div>
  )
}

export { McpConnectStep }
