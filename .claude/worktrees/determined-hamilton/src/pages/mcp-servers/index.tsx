import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, RefreshCw, Wrench, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { StatusDot } from '@/components/status-dot'
import { EmptyState } from '@/components/empty-state'
import { AddServerDialog } from './add-server-dialog'
import { useMcp } from '@/hooks/use-mcp'

function McpServersPage() {
  const { servers, addServer, removeServer, connectServer, disconnectServer } = useMcp()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <ScrollArea className="h-full">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">MCP Servers</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Manage your Model Context Protocol server connections.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Server
            </Button>
          </div>

          {servers.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No MCP servers"
              description="Add an MCP server to connect your tools and data sources."
              actionLabel="Add Server"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <Card key={server.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
                          <Server className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{server.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusDot status={server.status} showLabel />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {server.status === 'connected' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectServer(server.id)}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => connectServer(server.id)}
                            disabled={server.status === 'connecting'}
                            className="gap-1.5"
                          >
                            {server.status === 'connecting' && (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            )}
                            Connect
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-[hsl(var(--muted-foreground))] hover:text-red-500"
                          onClick={() => removeServer(server.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="rounded-lg bg-[hsl(var(--muted))] p-3 font-mono text-xs mb-4">
                      {server.command} {server.args.join(' ')}
                    </div>

                    {server.tools.length > 0 && (
                      <>
                        <Separator className="mb-3" />
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                              Available Tools ({server.tools.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {server.tools.map((tool) => (
                              <Badge key={tool.name} variant="secondary" className="text-xs font-mono">
                                {tool.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {server.last_connected && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-3">
                        Last connected: {new Date(server.last_connected).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <AddServerDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onAdd={addServer}
          />
        </div>
      </ScrollArea>
    </motion.div>
  )
}

export { McpServersPage }
