'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { HiChatBubbleLeftRight, HiEnvelope, HiBookOpen, HiCog6Tooth, HiMagnifyingGlass, HiPaperAirplane, HiArrowPath, HiArrowUpTray, HiTrash, HiExclamationTriangle, HiCheckCircle, HiClock, HiChevronRight, HiXMark, HiGlobeAlt, HiUser, HiDocumentText, HiAdjustmentsHorizontal, HiBolt, HiShieldCheck, HiChatBubbleOvalLeft } from 'react-icons/hi2'
import { SiGmail, SiSlack } from 'react-icons/si'

// ========== CONSTANTS ==========
const COORDINATOR_ID = '698a277a79bc02d9d4f13ce1'
const KNOWLEDGE_AGENT_ID = '698a274a3177114a698d5cc7'
const CHANNEL_AGENT_ID = '698a275e4d5b127836d8dadf'
const RAG_ID = '698a272960cd1fd2d988dece'
const LYZR_API_KEY = process.env.NEXT_PUBLIC_LYZR_API_KEY || ''

// ========== TYPES ==========
interface Message {
  id: string
  sender: 'customer' | 'agent'
  text: string
  timestamp: string
  channel?: string
  topicCategory?: string
  urgencyLevel?: string
  escalated?: boolean
  escalationReason?: string
  resolutionStatus?: string
}

interface Conversation {
  id: string
  customerName: string
  customerEmail: string
  lastMessage: string
  channel: 'chat' | 'email' | 'social'
  status: 'active' | 'pending' | 'escalated'
  timestamp: string
  unreadCount: number
  messages: Message[]
  topicCategory: string
  urgencyLevel: string
  escalated: boolean
  escalationReason: string
  resolutionStatus: string
}

interface KBDocument {
  fileName: string
  fileType: string
  status: string
}

interface ActivityEvent {
  id: string
  type: 'thinking' | 'processing' | 'completion' | 'error' | 'info'
  message: string
  timestamp: string
  agentName?: string
}

type Screen = 'conversations' | 'knowledge' | 'settings'

// ========== HELPER: Session ID Generator ==========
function generateSessionId(agentId: string): string {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 100000)
  return `session_${agentId}_${ts}_${rand}`
}

// ========== HELPER: Initials ==========
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ========== HELPER: Avatar color by name ==========
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// ========== MOCK DATA ==========
function createMockConversations(): Conversation[] {
  return [
    {
      id: '1',
      customerName: 'Sarah Johnson',
      customerEmail: 'sarah.johnson@example.com',
      lastMessage: 'Having trouble with my subscription renewal',
      channel: 'email',
      status: 'pending',
      timestamp: '2 min ago',
      unreadCount: 2,
      topicCategory: 'billing',
      urgencyLevel: 'medium',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'pending',
      messages: [
        { id: 'm1', sender: 'customer', text: 'Hi, I am having trouble with my subscription renewal. The payment keeps failing.', timestamp: '10:32 AM' },
        { id: 'm2', sender: 'agent', text: 'I am sorry to hear about the trouble with your subscription renewal. Let me look into this for you right away.', timestamp: '10:33 AM' },
        { id: 'm3', sender: 'customer', text: 'Having trouble with my subscription renewal', timestamp: '10:35 AM' },
      ]
    },
    {
      id: '2',
      customerName: 'Mike Chen',
      customerEmail: 'mike.chen@techcorp.io',
      lastMessage: 'How do I integrate the API?',
      channel: 'chat',
      status: 'active',
      timestamp: '5 min ago',
      unreadCount: 1,
      topicCategory: 'technical support',
      urgencyLevel: 'low',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'in_progress',
      messages: [
        { id: 'm4', sender: 'customer', text: 'How do I integrate the API? I need the REST endpoints documentation.', timestamp: '10:28 AM' },
        { id: 'm5', sender: 'agent', text: 'Great question! I can help you with the API integration. Our REST API documentation is available at docs.example.com/api. Would you like me to walk you through the authentication setup?', timestamp: '10:29 AM' },
      ]
    },
    {
      id: '3',
      customerName: 'Lisa Park',
      customerEmail: 'lisa.park@gmail.com',
      lastMessage: 'Need help with billing',
      channel: 'chat',
      status: 'escalated',
      timestamp: '12 min ago',
      unreadCount: 0,
      topicCategory: 'billing',
      urgencyLevel: 'high',
      escalated: true,
      escalationReason: 'Customer requested to speak with a manager',
      resolutionStatus: 'escalated',
      messages: [
        { id: 'm6', sender: 'customer', text: 'I was charged twice for my last invoice. I need to speak to a manager about this.', timestamp: '10:20 AM' },
        { id: 'm7', sender: 'agent', text: 'I understand your concern about the double charge. Let me escalate this to our billing specialist who can resolve this immediately.', timestamp: '10:21 AM' },
        { id: 'm8', sender: 'customer', text: 'Need help with billing', timestamp: '10:23 AM' },
      ]
    },
    {
      id: '4',
      customerName: 'James Wilson',
      customerEmail: 'j.wilson@enterprise.co',
      lastMessage: 'Feature request for dashboard',
      channel: 'social',
      status: 'active',
      timestamp: '30 min ago',
      unreadCount: 0,
      topicCategory: 'feature request',
      urgencyLevel: 'low',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'in_progress',
      messages: [
        { id: 'm9', sender: 'customer', text: 'It would be great if the dashboard had real-time analytics widgets. Any plans for that?', timestamp: '10:02 AM' },
        { id: 'm10', sender: 'agent', text: 'Thank you for the suggestion! Real-time analytics is on our product roadmap. I will pass your feedback to our product team.', timestamp: '10:04 AM' },
      ]
    },
    {
      id: '5',
      customerName: 'Emma Davis',
      customerEmail: 'emma.davis@startup.io',
      lastMessage: 'Password reset not working',
      channel: 'email',
      status: 'pending',
      timestamp: '1 hour ago',
      unreadCount: 3,
      topicCategory: 'account access',
      urgencyLevel: 'high',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'pending',
      messages: [
        { id: 'm11', sender: 'customer', text: 'I have tried resetting my password three times but the reset email never arrives. Please help urgently.', timestamp: '9:30 AM' },
      ]
    },
    {
      id: '6',
      customerName: 'Alex Rivera',
      customerEmail: 'alex.r@bigco.com',
      lastMessage: 'Looking for enterprise pricing',
      channel: 'chat',
      status: 'active',
      timestamp: '2 hours ago',
      unreadCount: 0,
      topicCategory: 'product inquiry',
      urgencyLevel: 'medium',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'in_progress',
      messages: [
        { id: 'm12', sender: 'customer', text: 'We are evaluating platforms for our 500-person team. Can you share enterprise pricing details?', timestamp: '8:30 AM' },
        { id: 'm13', sender: 'agent', text: 'Thank you for your interest in our enterprise plan. For teams of that size, we offer custom pricing with dedicated support. I will connect you with our sales team for a personalized quote.', timestamp: '8:32 AM' },
      ]
    },
    {
      id: '7',
      customerName: 'Priya Sharma',
      customerEmail: 'priya.s@devhub.in',
      lastMessage: 'Integration documentation question',
      channel: 'social',
      status: 'pending',
      timestamp: '3 hours ago',
      unreadCount: 1,
      topicCategory: 'technical support',
      urgencyLevel: 'low',
      escalated: false,
      escalationReason: '',
      resolutionStatus: 'pending',
      messages: [
        { id: 'm14', sender: 'customer', text: 'Where can I find the webhook integration docs? The link in your help center seems broken.', timestamp: '7:30 AM' },
      ]
    },
  ]
}

// ========== ACTIVITY PANEL COMPONENT ==========
function ActivityPanel({ events, isLoading }: { events: ActivityEvent[]; isLoading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  function getEventIcon(type: string) {
    switch (type) {
      case 'thinking': return <HiClock className="w-3.5 h-3.5 text-amber-500" />
      case 'processing': return <HiArrowPath className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'completion': return <HiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
      case 'error': return <HiExclamationTriangle className="w-3.5 h-3.5 text-red-500" />
      default: return <HiBolt className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  if (!isLoading && events.length === 0) return null

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)' }}>
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
        <HiBolt className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Agent Activity</span>
        {isLoading && <span className="ml-auto flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>}
      </div>
      <div ref={scrollRef} className="max-h-40 overflow-y-auto p-2 space-y-1.5">
        {events.map((evt) => (
          <div key={evt.id} className="flex items-start gap-2 text-xs">
            <div className="mt-0.5 shrink-0">{getEventIcon(evt.type)}</div>
            <div className="flex-1 min-w-0">
              <span className="text-foreground">{evt.message}</span>
              {evt.agentName && <span className="text-muted-foreground ml-1">({evt.agentName})</span>}
            </div>
            <span className="text-muted-foreground shrink-0">{evt.timestamp}</span>
          </div>
        ))}
        {isLoading && events.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HiArrowPath className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting to agent activity stream...</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== AGENT INFO PANEL ==========
function AgentInfoPanel({ activeAgentId }: { activeAgentId: string | null }) {
  const agents = [
    { id: COORDINATOR_ID, name: 'Customer Service Coordinator', purpose: 'Orchestrates customer queries across sub-agents', icon: <HiChatBubbleLeftRight className="w-4 h-4" /> },
    { id: KNOWLEDGE_AGENT_ID, name: 'Knowledge Retrieval Agent', purpose: 'Searches knowledge base for answers', icon: <HiBookOpen className="w-4 h-4" /> },
    { id: CHANNEL_AGENT_ID, name: 'Channel Response Agent', purpose: 'Formats responses for each channel', icon: <HiChatBubbleOvalLeft className="w-4 h-4" /> },
  ]

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)' }}>
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-xs font-semibold text-foreground">Agent Network</span>
      </div>
      <div className="p-2 space-y-1">
        {agents.map((agent) => (
          <div key={agent.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${activeAgentId === agent.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            <div className="shrink-0">{agent.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-foreground">{agent.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{agent.purpose}</div>
            </div>
            <div className={`w-2 h-2 rounded-full shrink-0 ${activeAgentId === agent.id ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/30'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ========== CONVERSATIONS SCREEN ==========
function ConversationsScreen({
  conversations,
  setConversations,
  selectedConvoId,
  setSelectedConvoId,
  activeAgentId,
  setActiveAgentId,
  activityEvents,
  setActivityEvents,
  isAgentLoading,
  setIsAgentLoading,
}: {
  conversations: Conversation[]
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
  selectedConvoId: string
  setSelectedConvoId: (id: string) => void
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
  activityEvents: ActivityEvent[]
  setActivityEvents: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
  isAgentLoading: boolean
  setIsAgentLoading: (loading: boolean) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'chat' | 'email' | 'social'>('all')
  const [messageInput, setMessageInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedConvo = conversations.find(c => c.id === selectedConvoId)
  const filteredConvos = conversations.filter(c => {
    const matchesChannel = channelFilter === 'all' || c.channel === channelFilter
    const matchesSearch = !searchQuery || c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesChannel && matchesSearch
  })

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedConvo?.messages])

  const addActivityEvent = useCallback((type: ActivityEvent['type'], message: string, agentName?: string) => {
    const now = new Date()
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    setActivityEvents(prev => [...prev, { id: `evt_${Date.now()}_${Math.random()}`, type, message, timestamp: ts, agentName }])
  }, [setActivityEvents])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvo || isAgentLoading) return

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'customer',
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setConversations(prev => prev.map(c => c.id === selectedConvoId ? { ...c, messages: [...c.messages, userMsg], lastMessage: messageInput.trim() } : c))
    setMessageInput('')
    setIsAgentLoading(true)
    setActiveAgentId(COORDINATOR_ID)
    setActivityEvents([])

    const sessionId = generateSessionId(COORDINATOR_ID)

    addActivityEvent('info', 'Starting customer service request...', 'System')
    addActivityEvent('processing', 'Routing to Customer Service Coordinator', 'Coordinator')

    // Connect WebSocket for activity stream
    try {
      if (LYZR_API_KEY) {
        const wsUrl = `wss://metrics.studio.lyzr.ai/ws/${sessionId}?x-api-key=${LYZR_API_KEY}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            const msgType = data?.type || 'info'
            const msgText = data?.message || data?.text || JSON.stringify(data)
            const agent = data?.agent_name || data?.agentName || ''
            let eventType: ActivityEvent['type'] = 'info'
            if (msgType === 'thinking' || msgText.toLowerCase().includes('thinking')) eventType = 'thinking'
            else if (msgType === 'processing' || msgText.toLowerCase().includes('processing')) eventType = 'processing'
            else if (msgType === 'completion' || msgText.toLowerCase().includes('complet')) eventType = 'completion'
            else if (msgType === 'error') eventType = 'error'
            addActivityEvent(eventType, msgText, agent)
          } catch {
            // ignore unparseable messages
          }
        }

        ws.onerror = () => { /* ignore ws errors */ }
      }
    } catch {
      // WebSocket connection optional
    }

    try {
      addActivityEvent('processing', 'Querying knowledge base...', 'Knowledge Retrieval Agent')
      const result = await callAIAgent(messageInput.trim(), COORDINATOR_ID, { session_id: sessionId })

      addActivityEvent('processing', 'Formatting channel response...', 'Channel Response Agent')

      if (result.success && result.response) {
        const resData = result.response?.result?.data || result.response?.result || {}
        const customerResponse = resData?.customer_response || resData?.answer || result.response?.result?.summary || result.response?.message || 'Thank you for your message. I am looking into this for you.'
        const channel = resData?.channel || selectedConvo.channel
        const topicCategory = resData?.topic_category || selectedConvo.topicCategory
        const urgencyLevel = resData?.urgency_level || selectedConvo.urgencyLevel
        const escalated = resData?.escalated ?? selectedConvo.escalated
        const escalationReason = resData?.escalation_reason || selectedConvo.escalationReason
        const resolutionStatus = resData?.resolution_status || selectedConvo.resolutionStatus

        const agentMsg: Message = {
          id: `msg_${Date.now()}_agent`,
          sender: 'agent',
          text: customerResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel,
          topicCategory,
          urgencyLevel,
          escalated,
          escalationReason,
          resolutionStatus,
        }

        setConversations(prev => prev.map(c => c.id === selectedConvoId ? {
          ...c,
          messages: [...c.messages, agentMsg],
          lastMessage: customerResponse.slice(0, 60) + (customerResponse.length > 60 ? '...' : ''),
          topicCategory,
          urgencyLevel,
          escalated,
          escalationReason,
          resolutionStatus,
          status: escalated ? 'escalated' as const : 'active' as const,
        } : c))

        addActivityEvent('completion', 'Response delivered successfully', 'Coordinator')
      } else {
        const errorMsg: Message = {
          id: `msg_${Date.now()}_err`,
          sender: 'agent',
          text: 'I apologize, but I encountered an issue processing your request. Please try again or contact support.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setConversations(prev => prev.map(c => c.id === selectedConvoId ? { ...c, messages: [...c.messages, errorMsg] } : c))
        addActivityEvent('error', result?.error || 'Failed to get response', 'System')
      }
    } catch (err) {
      addActivityEvent('error', 'Network error occurred', 'System')
    } finally {
      setIsAgentLoading(false)
      setActiveAgentId(null)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }

  function channelBadge(ch: string) {
    switch (ch) {
      case 'chat': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0"><HiChatBubbleLeftRight className="w-3 h-3 mr-0.5 inline" />Chat</Badge>
      case 'email': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0"><HiEnvelope className="w-3 h-3 mr-0.5 inline" />Email</Badge>
      case 'social': return <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0"><HiGlobeAlt className="w-3 h-3 mr-0.5 inline" />Social</Badge>
      default: return <Badge variant="secondary" className="text-[10px]">{ch}</Badge>
    }
  }

  function statusDot(st: string) {
    switch (st) {
      case 'active': return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" title="Active" />
      case 'pending': return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Pending" />
      case 'escalated': return <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block animate-pulse" title="Escalated" />
      default: return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 inline-block" />
    }
  }

  function urgencyBadge(level: string) {
    switch (level) {
      case 'high': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">High</Badge>
      case 'medium': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Medium</Badge>
      case 'low': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Low</Badge>
      default: return <Badge variant="secondary" className="text-[10px]">{level || 'N/A'}</Badge>
    }
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Conversation List */}
      <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border/50 overflow-hidden" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
        <div className="p-3 border-b border-border/50 space-y-2">
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-8 h-9 bg-background/50 border-border/50 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {(['all', 'chat', 'email', 'social'] as const).map((ch) => (
              <button key={ch} onClick={() => setChannelFilter(ch)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${channelFilter === ch ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                {ch === 'all' ? 'All' : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {filteredConvos.map((c) => (
              <button key={c.id} onClick={() => setSelectedConvoId(c.id)} className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${selectedConvoId === c.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/60 border border-transparent'}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar className={`w-9 h-9 shrink-0 ${getAvatarColor(c.customerName)}`}>
                    <AvatarFallback className="text-white text-xs font-semibold bg-transparent">{getInitials(c.customerName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground truncate">{c.customerName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{c.timestamp}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {channelBadge(c.channel)}
                      {statusDot(c.status)}
                      {c.unreadCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center leading-none px-1">{c.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Center Panel - Active Chat */}
      <div className="flex-1 flex flex-col rounded-xl border border-border/50 overflow-hidden" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
        {selectedConvo ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
              <Avatar className={`w-9 h-9 ${getAvatarColor(selectedConvo.customerName)}`}>
                <AvatarFallback className="text-white text-xs font-semibold bg-transparent">{getInitials(selectedConvo.customerName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{selectedConvo.customerName}</span>
                  {channelBadge(selectedConvo.channel)}
                  {statusDot(selectedConvo.status)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{selectedConvo.topicCategory}</span>
                  {selectedConvo.escalated && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Escalated</Badge>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {Array.isArray(selectedConvo.messages) && selectedConvo.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${msg.sender === 'agent' ? 'order-1' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${msg.sender === 'agent' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-secondary text-secondary-foreground rounded-bl-md'}`}>
                        {msg.text}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 ${msg.sender === 'agent' ? 'justify-end' : ''}`}>
                        <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                        {msg.sender === 'agent' && msg.escalated && <HiExclamationTriangle className="w-3 h-3 text-amber-500" />}
                      </div>
                    </div>
                  </div>
                ))}
                {isAgentLoading && (
                  <div className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="rounded-2xl rounded-br-md px-4 py-3 bg-primary/10">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-xs text-muted-foreground">Agent is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Activity Stream */}
            <div className="px-4">
              <ActivityPanel events={activityEvents} isLoading={isAgentLoading} />
            </div>

            {/* Message Composer */}
            <div className="p-3 border-t border-border/50">
              <div className="flex gap-2">
                <Textarea placeholder="Type your message..." className="resize-none min-h-[42px] max-h-24 bg-background/50 border-border/50 text-sm" rows={1} value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }} />
                <Button onClick={handleSendMessage} disabled={!messageInput.trim() || isAgentLoading} className="shrink-0 h-auto px-4 bg-primary hover:bg-primary/90">
                  <HiPaperAirplane className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <HiChatBubbleLeftRight className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">Choose a conversation from the list to start viewing and responding to customer messages.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Customer Context */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        {selectedConvo ? (
          <>
            {/* Customer Profile */}
            <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className={`w-11 h-11 ${getAvatarColor(selectedConvo.customerName)}`}>
                    <AvatarFallback className="text-white text-sm font-semibold bg-transparent">{getInitials(selectedConvo.customerName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{selectedConvo.customerName}</div>
                    <div className="text-xs text-muted-foreground">{selectedConvo.customerEmail}</div>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Channel</span>
                    {channelBadge(selectedConvo.channel)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Topic</span>
                    <span className="font-medium text-foreground capitalize">{selectedConvo.topicCategory}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Urgency</span>
                    {urgencyBadge(selectedConvo.urgencyLevel)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Resolution</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{selectedConvo.resolutionStatus?.replace('_', ' ') || 'N/A'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Escalation Status */}
            {selectedConvo.escalated && (
              <Card className="border-red-200 shadow-none" style={{ background: 'rgba(254,242,242,0.75)', backdropFilter: 'blur(16px)' }}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <HiExclamationTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-semibold text-red-700">Escalated</span>
                  </div>
                  <p className="text-xs text-red-600">{selectedConvo.escalationReason || 'No reason provided'}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
              <CardContent className="p-3 space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Quick Actions</span>
                <div className="space-y-1">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 border-border/50" onClick={() => setConversations(prev => prev.map(c => c.id === selectedConvoId ? { ...c, escalated: true, status: 'escalated', resolutionStatus: 'escalated', escalationReason: 'Manually escalated by agent' } : c))}>
                    <HiExclamationTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Escalate
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 border-border/50" onClick={() => setConversations(prev => prev.map(c => c.id === selectedConvoId ? { ...c, resolutionStatus: 'resolved', status: 'active', escalated: false } : c))}>
                    <HiCheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Mark Resolved
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 border-border/50 text-muted-foreground">
                    <HiXMark className="w-3.5 h-3.5 mr-1.5" /> Archive
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card className="border-border/50 shadow-none flex-1" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
              <CardContent className="p-3">
                <span className="text-xs font-semibold text-foreground">Timeline</span>
                <div className="mt-2 space-y-2">
                  {Array.isArray(selectedConvo.messages) && selectedConvo.messages.slice(-4).map((msg, idx) => (
                    <div key={msg.id} className="flex gap-2 text-[11px]">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1 ${msg.sender === 'agent' ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                        {idx < Math.min((selectedConvo?.messages?.length ?? 0), 4) - 1 && <div className="w-px flex-1 bg-border mt-0.5" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <span className="font-medium text-foreground">{msg.sender === 'agent' ? 'Agent' : selectedConvo.customerName.split(' ')[0]}</span>
                        <span className="text-muted-foreground ml-1">{msg.timestamp}</span>
                        <p className="text-muted-foreground truncate">{msg.text.slice(0, 50)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-border/50 p-6" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <div className="text-center">
              <HiUser className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Select a conversation to view customer details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== KNOWLEDGE BASE SCREEN ==========
function KnowledgeBaseScreen({ activeAgentId, setActiveAgentId }: { activeAgentId: string | null; setActiveAgentId: (id: string | null) => void }) {
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    if (!RAG_ID) {
      setFetchError('Knowledge base not configured. RAG ID is missing.')
      return
    }
    setLoadingDocs(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/rag?ragId=${encodeURIComponent(RAG_ID)}`)
      const data = await res.json()
      if (data?.success && Array.isArray(data?.documents)) {
        setDocuments(data.documents)
      } else {
        const errMsg = data?.error || 'Failed to load documents'
        if (errMsg.includes('ragId is required')) {
          setFetchError('Knowledge base connection issue. The RAG ID may not be configured correctly.')
        } else if (errMsg.includes('LYZR_API_KEY not configured')) {
          setFetchError('Server configuration issue: LYZR_API_KEY environment variable is not set on the server.')
        } else {
          setFetchError(errMsg)
        }
      }
    } catch {
      setFetchError('Network error loading documents')
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !RAG_ID) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('ragId', RAG_ID)
      formData.append('file', file)
      const res = await fetch('/api/rag', { method: 'POST', body: formData })
      const data = await res.json()
      if (data?.success) {
        fetchDocuments()
      } else {
        setUploadError(data?.error || 'Upload failed')
      }
    } catch {
      setUploadError('Network error during upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!RAG_ID) return
    setDeleting(fileName)
    try {
      const res = await fetch('/api/rag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragId: RAG_ID, documentNames: [fileName] }),
      })
      const data = await res.json()
      if (data?.success) {
        setDocuments(prev => prev.filter(d => d.fileName !== fileName))
      }
    } catch {
      // silent fail
    } finally {
      setDeleting(null)
    }
  }

  const handleTestQuery = async () => {
    if (!testQuery.trim()) return
    setTestLoading(true)
    setTestResult(null)
    setActiveAgentId(KNOWLEDGE_AGENT_ID)
    try {
      const result = await callAIAgent(testQuery.trim(), KNOWLEDGE_AGENT_ID)
      if (result?.success && result?.response?.result) {
        const data = result.response.result?.data || result.response.result
        const answer = data?.answer || result.response?.result?.summary || result.response?.message || 'No answer found'
        const confidence = data?.confidence || 'N/A'
        const sources = data?.sources || 'N/A'
        setTestResult(`Answer: ${answer}\n\nConfidence: ${confidence}\nSources: ${sources}`)
      } else {
        setTestResult(result?.error || 'Failed to get answer')
      }
    } catch {
      setTestResult('Network error')
    } finally {
      setTestLoading(false)
      setActiveAgentId(null)
    }
  }

  function fileTypeIcon(type: string) {
    switch (type) {
      case 'pdf': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">PDF</Badge>
      case 'docx': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">DOCX</Badge>
      case 'txt': return <Badge className="bg-muted text-muted-foreground text-[10px]">TXT</Badge>
      default: return <Badge variant="secondary" className="text-[10px]">{type}</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Knowledge Base Management</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage documents and data sources that power the AI knowledge retrieval agent.</p>
      </div>

      {/* Website Source */}
      <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HiGlobeAlt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-foreground">Website Source</div>
              <div className="text-xs text-muted-foreground">https://www.lyzr.ai</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><HiCheckCircle className="w-3 h-3 mr-0.5 inline" />Synced</Badge>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <HiArrowPath className="w-3.5 h-3.5 mr-1" /> Sync Website
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Documents</CardTitle>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleUpload} />
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <HiArrowPath className="w-3.5 h-3.5 mr-1 animate-spin" /> : <HiArrowUpTray className="w-3.5 h-3.5 mr-1" />}
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={fetchDocuments} disabled={loadingDocs}>
                <HiArrowPath className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {uploadError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs mb-3">
              <HiExclamationTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-auto"><HiXMark className="w-3.5 h-3.5" /></button>
            </div>
          )}
          {fetchError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs mb-3">
              <HiExclamationTriangle className="w-4 h-4 shrink-0" />
              <span>{fetchError}</span>
              <button onClick={() => setFetchError(null)} className="ml-auto shrink-0"><HiXMark className="w-3.5 h-3.5" /></button>
            </div>
          )}
          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-1.5">
              {documents.map((doc) => (
                <div key={doc.fileName} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <HiDocumentText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground flex-1 truncate">{doc.fileName}</span>
                  {fileTypeIcon(doc.fileType)}
                  <Badge variant="secondary" className="text-[10px] capitalize">{doc.status}</Badge>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(doc.fileName)} disabled={deleting === doc.fileName}>
                    {deleting === doc.fileName ? <HiArrowPath className="w-3.5 h-3.5 animate-spin" /> : <HiTrash className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HiDocumentText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">Upload PDF, DOCX, or TXT files to train the knowledge base</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Query */}
      <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Test Knowledge Base</CardTitle>
          <CardDescription className="text-xs">Send a test query to verify the knowledge base returns relevant answers.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Ask a question..." className="bg-background/50 border-border/50 text-sm" value={testQuery} onChange={(e) => setTestQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleTestQuery() }} />
            <Button onClick={handleTestQuery} disabled={!testQuery.trim() || testLoading} className="shrink-0 bg-primary hover:bg-primary/90">
              {testLoading ? <HiArrowPath className="w-4 h-4 animate-spin" /> : <HiMagnifyingGlass className="w-4 h-4" />}
            </Button>
          </div>
          {testResult && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm text-foreground whitespace-pre-wrap">{testResult}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ========== SETTINGS SCREEN ==========
function SettingsScreen() {
  const [escalationKeywords, setEscalationKeywords] = useState(['speak to manager', 'human', 'escalate', 'complaint', 'legal'])
  const [newKeyword, setNewKeyword] = useState('')
  const [confidenceThreshold, setConfidenceThreshold] = useState(70)
  const [autoEscalate, setAutoEscalate] = useState(true)
  const [tone, setTone] = useState<'professional' | 'friendly' | 'casual'>('professional')
  const [responseLength, setResponseLength] = useState<'concise' | 'standard' | 'detailed'>('standard')
  const [greeting, setGreeting] = useState('Hello! Thank you for reaching out. How can I assist you today?')
  const [signoff, setSignoff] = useState('Best regards, The Support Team')

  const addKeyword = () => {
    if (newKeyword.trim() && !escalationKeywords.includes(newKeyword.trim().toLowerCase())) {
      setEscalationKeywords(prev => [...prev, newKeyword.trim().toLowerCase()])
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => {
    setEscalationKeywords(prev => prev.filter(k => k !== kw))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings & Channels</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure channel integrations, escalation rules, and brand voice settings.</p>
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="channels" className="text-xs data-[state=active]:bg-card">Channels</TabsTrigger>
          <TabsTrigger value="escalation" className="text-xs data-[state=active]:bg-card">Escalation Rules</TabsTrigger>
          <TabsTrigger value="brand" className="text-xs data-[state=active]:bg-card">Brand Voice</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="mt-4 space-y-3">
          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <SiGmail className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Gmail Integration</span>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><HiCheckCircle className="w-3 h-3 mr-0.5 inline" />Connected</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Monitoring support@company.com for incoming customer emails</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>142 emails processed today</span>
                    <span>Avg. response: 2.3 min</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <SiSlack className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Slack Integration</span>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><HiCheckCircle className="w-3 h-3 mr-0.5 inline" />Connected</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Active in #customer-support and #help-desk channels</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>89 messages today</span>
                    <span>3 active threads</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <HiChatBubbleLeftRight className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Live Chat Widget</span>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"><HiCheckCircle className="w-3 h-3 mr-0.5 inline" />Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Embedded on website and mobile app for real-time customer support</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>56 active chats</span>
                    <span>94% satisfaction rate</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escalation Rules Tab */}
        <TabsContent value="escalation" className="mt-4 space-y-3">
          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Keyword Triggers</CardTitle>
              <CardDescription className="text-xs">Messages containing these keywords will trigger escalation review.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {escalationKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs py-1 px-2 gap-1">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-red-500 transition-colors"><HiXMark className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add keyword..." className="bg-background/50 border-border/50 text-sm" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addKeyword() }} />
                <Button variant="outline" size="sm" onClick={addKeyword} className="shrink-0 text-xs h-9">Add</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Confidence Threshold</span>
                  <span className="text-sm font-semibold text-primary">{confidenceThreshold}%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Escalate when AI confidence falls below this threshold.</p>
                <div className="relative">
                  <Progress value={confidenceThreshold} className="h-2" />
                  <input type="range" min={0} max={100} value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Auto-Escalation</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically escalate based on keyword triggers and confidence threshold.</p>
                </div>
                <Switch checked={autoEscalate} onCheckedChange={setAutoEscalate} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Voice Tab */}
        <TabsContent value="brand" className="mt-4 space-y-3">
          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tone & Style</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">Response Tone</span>
                <div className="flex gap-2">
                  {(['professional', 'friendly', 'casual'] as const).map((t) => (
                    <button key={t} onClick={() => setTone(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tone === t ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">Response Length</span>
                <div className="flex gap-2">
                  {(['concise', 'standard', 'detailed'] as const).map((l) => (
                    <button key={l} onClick={() => setResponseLength(l)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${responseLength === l ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Custom Messages</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Greeting Message</span>
                <Textarea className="bg-background/50 border-border/50 text-sm resize-none" rows={2} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Sign-off Message</span>
                <Textarea className="bg-background/50 border-border/50 text-sm resize-none" rows={2} value={signoff} onChange={(e) => setSignoff(e.target.value)} />
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-sm">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ========== LIVE CHAT WIDGET ==========
interface LiveChatMessage {
  id: string
  sender: 'user' | 'agent'
  text: string
  timestamp: string
}

function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => generateSessionId(COORDINATOR_ID))
  const [hasGreeted, setHasGreeted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen && !hasGreeted) {
      setMessages([{
        id: 'greeting',
        sender: 'agent',
        text: 'Hello! Welcome to our support. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setHasGreeted(true)
    }
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, hasGreeted])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userText = input.trim()
    const userMsg: LiveChatMessage = {
      id: `lc_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const result = await callAIAgent(userText, COORDINATOR_ID, { session_id: sessionId })

      let agentText = 'I apologize, but I encountered an issue. Please try again.'
      if (result.success && result.response) {
        const resData = result.response?.result?.data || result.response?.result || {}
        agentText = resData?.customer_response || resData?.answer || result.response?.result?.summary || result.response?.message || agentText
      } else if (result?.error) {
        agentText = 'Sorry, I am having trouble connecting right now. Please try again in a moment.'
      }

      const agentMsg: LiveChatMessage = {
        id: `lc_${Date.now()}_agent`,
        sender: 'agent',
        text: agentText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, agentMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: `lc_${Date.now()}_err`,
        sender: 'agent',
        text: 'Network error occurred. Please check your connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const unreadCount = 0

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[560px] flex flex-col rounded-2xl border border-border/50 shadow-2xl shadow-primary/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border/50" style={{ background: 'hsl(230 85% 55%)', color: 'white' }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <HiChatBubbleLeftRight className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Live Support Chat</div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>AI Agent Online</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors">
              <HiXMark className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: '380px', minHeight: '280px' }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.sender === 'user' ? '' : 'flex items-start gap-2'}`}>
                  {msg.sender === 'agent' && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <HiBolt className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-md' : 'bg-secondary/70 text-foreground rounded-bl-md'}`}>
                      {msg.text}
                    </div>
                    <div className={`text-[10px] text-muted-foreground mt-1 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <HiBolt className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-secondary/70">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-3 py-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-md shadow-primary/20"
              >
                <HiPaperAirplane className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              <HiShieldCheck className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground/60">Powered by AI Customer Service</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Open Live Chat"
      >
        {isOpen ? (
          <HiXMark className="w-6 h-6 text-white" />
        ) : (
          <HiChatBubbleOvalLeft className="w-6 h-6 text-white" />
        )}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>
        )}
      </button>
    </>
  )
}

// ========== MAIN PAGE ==========
export default function Home() {
  const [activeScreen, setActiveScreen] = useState<Screen>('conversations')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvoId, setSelectedConvoId] = useState<string>('')
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [isAgentLoading, setIsAgentLoading] = useState(false)

  useEffect(() => {
    if (sampleDataOn) {
      const mock = createMockConversations()
      setConversations(mock)
      setSelectedConvoId(mock[0].id)
    } else {
      setConversations([])
      setSelectedConvoId('')
    }
  }, [sampleDataOn])

  const navItems: { key: Screen; label: string; icon: React.ReactNode }[] = [
    { key: 'conversations', label: 'Conversations', icon: <HiChatBubbleLeftRight className="w-5 h-5" /> },
    { key: 'knowledge', label: 'Knowledge Base', icon: <HiBookOpen className="w-5 h-5" /> },
    { key: 'settings', label: 'Settings', icon: <HiCog6Tooth className="w-5 h-5" /> },
  ]

  const openTickets = conversations.filter(c => c.status === 'pending' || c.status === 'escalated').length
  const escalatedCount = conversations.filter(c => c.status === 'escalated').length

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, hsl(230 50% 95%) 0%, hsl(260 45% 94%) 40%, hsl(220 50% 95%) 70%, hsl(200 45% 94%) 100%)' }}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-white/18 h-screen sticky top-0" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', borderRight: '1px solid rgba(255,255,255,0.18)' }}>
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <HiChatBubbleLeftRight className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">Omni-Channel Hub</h1>
              <p className="text-[10px] text-muted-foreground">Customer Service</p>
            </div>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => setActiveScreen(item.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeScreen === item.key ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}>
              {item.icon}
              <span>{item.label}</span>
              {item.key === 'conversations' && openTickets > 0 && (
                <span className={`ml-auto text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${activeScreen === item.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>{openTickets}</span>
              )}
            </button>
          ))}
        </nav>

        <Separator className="mx-4" />

        {/* Sample Data Toggle */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Sample Data</span>
            <Switch checked={sampleDataOn} onCheckedChange={setSampleDataOn} />
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Metrics Summary */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Open Tickets</span>
            <span className="text-sm font-bold text-foreground">{openTickets}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Escalated</span>
            <span className="text-sm font-bold text-red-500">{escalatedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Avg Response</span>
            <span className="text-sm font-bold text-foreground">2.3m</span>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Agent Info */}
        <div className="px-3 py-3">
          <AgentInfoPanel activeAgentId={activeAgentId} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="px-6 py-3 flex items-center justify-between shrink-0 border-b" style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {activeScreen === 'conversations' && 'Conversations'}
              {activeScreen === 'knowledge' && 'Knowledge Base'}
              {activeScreen === 'settings' && 'Settings & Channels'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {isAgentLoading && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] gap-1 animate-pulse">
                <HiArrowPath className="w-3 h-3 animate-spin" /> Agent Processing
              </Badge>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-5">
          {activeScreen === 'conversations' && (
            <ConversationsScreen
              conversations={conversations}
              setConversations={setConversations}
              selectedConvoId={selectedConvoId}
              setSelectedConvoId={setSelectedConvoId}
              activeAgentId={activeAgentId}
              setActiveAgentId={setActiveAgentId}
              activityEvents={activityEvents}
              setActivityEvents={setActivityEvents}
              isAgentLoading={isAgentLoading}
              setIsAgentLoading={setIsAgentLoading}
            />
          )}
          {activeScreen === 'knowledge' && (
            <KnowledgeBaseScreen activeAgentId={activeAgentId} setActiveAgentId={setActiveAgentId} />
          )}
          {activeScreen === 'settings' && (
            <SettingsScreen />
          )}
        </div>
      </main>

      {/* Live Chat Widget */}
      <LiveChatWidget />
    </div>
  )
}
