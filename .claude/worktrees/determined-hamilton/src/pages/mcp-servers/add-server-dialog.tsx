import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (server: { name: string; command: string; args: string[] }) => void
}

function AddServerDialog({ open, onOpenChange, onAdd }: AddServerDialogProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) return
    onAdd({
      name: name.trim(),
      command: command.trim(),
      args: args
        .split(' ')
        .map((a) => a.trim())
        .filter(Boolean),
    })
    setName('')
    setCommand('')
    setArgs('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Configure a new Model Context Protocol server connection.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Server Name</label>
            <Input
              placeholder="e.g., Newton School"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Command</label>
            <Input
              placeholder="e.g., npx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Arguments</label>
            <Input
              placeholder="e.g., -y @anthropic/newton-school-mcp"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Space-separated arguments for the command.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !command.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Server
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { AddServerDialog }
