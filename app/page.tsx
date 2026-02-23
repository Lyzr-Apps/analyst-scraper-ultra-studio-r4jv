'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  FiSearch,
  FiDownload,
  FiTrash2,
  FiX,
  FiPlus,
  FiArrowUp,
  FiArrowDown,
  FiLoader,
  FiGlobe,
  FiAlertCircle,
  FiCheck,
  FiUsers,
  FiLink,
  FiZap,
  FiTarget,
  FiExternalLink,
} from 'react-icons/fi'

// ── Agent IDs ──────────────────────────────────────────────
const URL_SUGGESTION_AGENT_ID = '699c3550dd37e749f18292dd'
const WEB_RESEARCH_AGENT_ID = '699c35504087cbffb92b3aba'

// ── Interfaces ─────────────────────────────────────────────
interface Contact {
  id: number
  name: string
  email: string
  company: string
  role: string
  source_url: string
  status: string
}

interface SuggestedUrl {
  url: string
  site_name: string
  description: string
  estimated_contacts: number
}

type SortKey = 'name' | 'email' | 'company' | 'role' | 'source_url' | 'status'
type SortDir = 'asc' | 'desc'

interface EditingCell {
  rowId: number
  field: SortKey
}

// ── Quick Topics ───────────────────────────────────────────
const QUICK_TOPICS = [
  'Investment Banking Analysts',
  'Management Consulting Teams',
  'Tech Company Leadership',
  'Hedge Fund Managers',
  'Venture Capital Partners',
  'Equity Research Analysts',
]

// ── Sample Data ────────────────────────────────────────────
const SAMPLE_CONTACTS: Contact[] = [
  { id: 1, name: 'Sarah Chen', email: 'sarah.chen@morganstanley.com', company: 'Morgan Stanley', role: 'Senior Equity Analyst', source_url: 'https://morganstanley.com/team', status: 'found' },
  { id: 2, name: 'James Rodriguez', email: 'j.rodriguez@goldmansachs.com', company: 'Goldman Sachs', role: 'VP Research', source_url: 'https://goldmansachs.com/research', status: 'found' },
  { id: 3, name: 'Emily Watkins', email: 'e.watkins@jpmorgan.com', company: 'JP Morgan', role: 'Credit Analyst', source_url: 'https://jpmorgan.com/analysts', status: 'found' },
  { id: 4, name: 'Michael Tanaka', email: '', company: 'Barclays Capital', role: 'Quantitative Analyst', source_url: 'https://barclays.com/team', status: 'partial' },
  { id: 5, name: 'Lisa Okonkwo', email: 'l.okonkwo@blackrock.com', company: 'BlackRock', role: 'Portfolio Analyst', source_url: 'https://blackrock.com/about', status: 'found' },
]

const SAMPLE_SUGGESTIONS: SuggestedUrl[] = [
  { url: 'https://morganstanley.com/people', site_name: 'Morgan Stanley', description: 'Team directory with equity research analysts and portfolio managers', estimated_contacts: 45 },
  { url: 'https://goldmansachs.com/our-firm/people', site_name: 'Goldman Sachs', description: 'Senior leadership and research team profiles', estimated_contacts: 30 },
  { url: 'https://jpmorgan.com/research/analysts', site_name: 'JP Morgan', description: 'Global research analyst directory', estimated_contacts: 55 },
]

// ── Helpers ────────────────────────────────────────────────
function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? '').toLowerCase()
  if (s === 'found') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        <FiCheck className="mr-1 h-3 w-3" />Found
      </Badge>
    )
  }
  if (s === 'partial') {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <FiAlertCircle className="mr-1 h-3 w-3" />Partial
      </Badge>
    )
  }
  if (s === 'failed') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        <FiX className="mr-1 h-3 w-3" />Failed
      </Badge>
    )
  }
  return <Badge variant="secondary">{status || 'Unknown'}</Badge>
}

function EditableCell({
  value,
  isEditing,
  onStartEdit,
  onFinishEdit,
}: {
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onFinishEdit: (newValue: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editValue, setEditValue] = useState(value)

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  React.useEffect(() => {
    setEditValue(value)
  }, [value])

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onFinishEdit(editValue)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onFinishEdit(editValue)
          if (e.key === 'Escape') onFinishEdit(value)
        }}
        className="h-7 text-sm px-2 py-1 border-primary/30"
      />
    )
  }

  return (
    <span
      onClick={onStartEdit}
      className="cursor-pointer hover:bg-muted/60 rounded px-1 py-0.5 transition-colors inline-block min-w-[2rem]"
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">--</span>}
    </span>
  )
}

function LoadingSkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell><Skeleton className="h-4 w-6" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-14" /></TableCell>
          <TableCell><Skeleton className="h-4 w-6" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ── Error Boundary ─────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Theme ──────────────────────────────────────────────────
const THEME_VARS = {
  '--background': '0 0% 100%',
  '--foreground': '222 47% 11%',
  '--card': '0 0% 98%',
  '--card-foreground': '222 47% 11%',
  '--primary': '222 47% 11%',
  '--primary-foreground': '210 40% 98%',
  '--secondary': '210 40% 96%',
  '--secondary-foreground': '222 47% 11%',
  '--muted': '210 40% 94%',
  '--muted-foreground': '215 16% 47%',
  '--border': '214 32% 91%',
  '--destructive': '0 84% 60%',
  '--radius': '0.875rem',
} as React.CSSProperties

// ── Main Page ──────────────────────────────────────────────
export default function Page() {
  // URL queue state
  const [urls, setUrls] = useState<string[]>([])
  const [urlInput, setUrlInput] = useState('')

  // URL Suggestion state
  const [suggestInput, setSuggestInput] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestedUrl[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [suggestSummary, setSuggestSummary] = useState('')

  // Contacts / scraping state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [summary, setSummary] = useState('')
  const [totalFound, setTotalFound] = useState(0)

  // Table state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)

  // Agent status
  const [activeAgent, setActiveAgent] = useState<'suggest' | 'research' | null>(null)

  // Input mode: 'suggest' | 'manual'
  const [inputMode, setInputMode] = useState<'suggest' | 'manual'>('suggest')

  // Sample data
  const [showSampleData, setShowSampleData] = useState(false)

  const [fieldToggles, setFieldToggles] = useState({
    name: true,
    email: true,
    company: true,
    role: true,
  })

  const displayContacts = showSampleData && contacts.length === 0 ? SAMPLE_CONTACTS : contacts
  const displaySuggestions = showSampleData && suggestions.length === 0 ? SAMPLE_SUGGESTIONS : suggestions

  // ── URL Add / Remove ───────────────────────────────────
  const addUrls = useCallback(() => {
    const newUrls = urlInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://') || u.includes('.')))
    if (newUrls.length > 0) {
      setUrls((prev) => [...prev, ...newUrls.filter((u) => !prev.includes(u))])
      setUrlInput('')
    }
  }, [urlInput])

  const removeUrl = useCallback((urlToRemove: string) => {
    setUrls((prev) => prev.filter((u) => u !== urlToRemove))
  }, [])

  const addSuggestionUrl = useCallback((url: string) => {
    setUrls((prev) => {
      if (prev.includes(url)) return prev
      return [...prev, url]
    })
  }, [])

  const addAllSuggestions = useCallback(() => {
    const displayedSuggestions = showSampleData && suggestions.length === 0 ? SAMPLE_SUGGESTIONS : suggestions
    const newUrls = displayedSuggestions.map((s) => s.url).filter((u) => u && !urls.includes(u))
    if (newUrls.length > 0) {
      setUrls((prev) => [...prev, ...newUrls])
    }
  }, [suggestions, urls, showSampleData])

  // ── Suggest URLs Handler ───────────────────────────────
  const handleSuggestUrls = useCallback(async () => {
    if (!suggestInput.trim()) return
    setSuggestLoading(true)
    setSuggestError('')
    setActiveAgent('suggest')

    try {
      const result = await callAIAgent(
        `Find the best website URLs where I can find analyst contact information for: ${suggestInput.trim()}. Look for team pages, about pages, staff directories, and professional listings. Return real, accessible URLs.`,
        URL_SUGGESTION_AGENT_ID
      )

      if (result.success) {
        const data = result?.response?.result
        if (data && Array.isArray(data?.suggested_urls)) {
          setSuggestions(data.suggested_urls.map((s: Record<string, unknown>) => ({
            url: (s?.url as string) ?? '',
            site_name: (s?.site_name as string) ?? '',
            description: (s?.description as string) ?? '',
            estimated_contacts: (s?.estimated_contacts as number) ?? 0,
          })))
          setSuggestSummary((data?.search_summary as string) ?? '')
        } else {
          // Fallback: try text response
          const textResult = data?.text ?? result?.response?.message ?? ''
          if (textResult) {
            setSuggestSummary(String(textResult))
            setSuggestions([])
          } else {
            setSuggestError('No URL suggestions returned. Try a different search term.')
          }
        }
      } else {
        setSuggestError(result?.error ?? 'Failed to get URL suggestions.')
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setSuggestLoading(false)
      setActiveAgent(null)
    }
  }, [suggestInput])

  // ── Scrape Contacts Handler ────────────────────────────
  const handleScrape = useCallback(async () => {
    if (urls.length === 0) return
    setLoading(true)
    setErrorMsg('')
    setActiveAgent('research')

    const urlList = urls.map((u, i) => `URL ${i + 1}: ${u}`).join('\n')
    const message = `Research the following websites and extract analyst contact information (name, email, company, role) from each. Use your web search capabilities to access these pages and find contact data:\n\n${urlList}\n\nReturn all contacts found with their source URLs and a status for each contact.`

    try {
      const result = await callAIAgent(message, WEB_RESEARCH_AGENT_ID)
      if (result.success) {
        const data = result?.response?.result
        if (data && Array.isArray(data?.contacts)) {
          const newContacts: Contact[] = data.contacts.map((c: Record<string, unknown>, i: number) => ({
            id: Date.now() + i,
            name: (c?.name as string) ?? '',
            email: (c?.email as string) ?? '',
            company: (c?.company as string) ?? '',
            role: (c?.role as string) ?? '',
            source_url: (c?.source_url as string) ?? '',
            status: (c?.status as string) ?? 'found',
          }))
          setContacts((prev) => [...prev, ...newContacts])
          setSummary((data?.summary as string) ?? '')
          setTotalFound((data?.total_found as number) ?? newContacts.length)
        } else {
          const textResult = data?.text ?? result?.response?.message ?? ''
          if (textResult) {
            setSummary(String(textResult))
          } else {
            setErrorMsg('No contacts found. The agent may not have been able to access these URLs.')
          }
        }
      } else {
        setErrorMsg(result?.error ?? 'An error occurred. Please try again.')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setLoading(false)
      setActiveAgent(null)
    }
  }, [urls])

  // ── Table helpers ──────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return key
      }
      setSortDir('asc')
      return key
    })
  }, [])

  const handleCellEdit = useCallback((rowId: number, field: SortKey, newValue: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === rowId ? { ...c, [field]: newValue } : c))
    )
    setEditingCell(null)
  }, [])

  const removeContact = useCallback((id: number) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const filteredAndSorted = useMemo(() => {
    let filtered = displayContacts
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q) ||
          (c.role ?? '').toLowerCase().includes(q) ||
          (c.source_url ?? '').toLowerCase().includes(q)
      )
    }
    const sorted = [...filtered].sort((a, b) => {
      const aVal = (a[sortKey] ?? '').toLowerCase()
      const bVal = (b[sortKey] ?? '').toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [displayContacts, searchQuery, sortKey, sortDir])

  const visibleColumnCount = useMemo(() => {
    let count = 3
    if (fieldToggles.name) count++
    if (fieldToggles.email) count++
    if (fieldToggles.company) count++
    if (fieldToggles.role) count++
    return count
  }, [fieldToggles])

  // ── CSV Export ─────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const activeFields: { key: SortKey; label: string }[] = []
    if (fieldToggles.name) activeFields.push({ key: 'name', label: 'Name' })
    if (fieldToggles.email) activeFields.push({ key: 'email', label: 'Email' })
    if (fieldToggles.company) activeFields.push({ key: 'company', label: 'Company' })
    if (fieldToggles.role) activeFields.push({ key: 'role', label: 'Role' })
    activeFields.push({ key: 'source_url', label: 'Source URL' })
    activeFields.push({ key: 'status', label: 'Status' })

    const header = activeFields.map((f) => f.label).join(',')
    const rows = filteredAndSorted.map((c) =>
      activeFields
        .map((f) => {
          const val = c[f.key] ?? ''
          return `"${val.replace(/"/g, '""')}"`
        })
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = 'analyst_contacts_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }, [filteredAndSorted, fieldToggles])

  // ── Sort Indicator ─────────────────────────────────────
  function SortIndicator({ field }: { field: SortKey }) {
    if (sortKey !== field) return <FiArrowUp className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />
    return sortDir === 'asc'
      ? <FiArrowUp className="h-3 w-3 text-primary" />
      : <FiArrowDown className="h-3 w-3 text-primary" />
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
        {/* Gradient background overlay */}
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, hsl(210 20% 97%) 0%, hsl(220 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 15% 97%) 100%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ── Header ──────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-primary/10 backdrop-blur-sm">
                  <FiUsers className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  Analyst Contact Scraper
                </h1>
              </div>
              <p className="text-muted-foreground text-sm ml-[3.25rem]" style={{ lineHeight: '1.55' }}>
                Extract structured contact data from any website using AI-powered web research
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={exportCSV}
              disabled={filteredAndSorted.length === 0}
              className="gap-2 backdrop-blur-md bg-white/75 border border-border shadow-sm hover:shadow-md transition-all"
            >
              <FiDownload className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* ── Input Section ───────────────────────── */}
          <Card className="mb-6 bg-white/75 backdrop-blur-md border-border shadow-md">
            <CardContent className="p-6">
              {/* Mode Tabs */}
              <div className="flex gap-1 mb-5 bg-muted/40 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setInputMode('suggest')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'suggest' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FiZap className="h-3.5 w-3.5" />
                  AI Suggest URLs
                </button>
                <button
                  onClick={() => setInputMode('manual')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${inputMode === 'manual' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FiGlobe className="h-3.5 w-3.5" />
                  Manual URLs
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: URL input area */}
                <div className="lg:col-span-2 space-y-4">
                  {inputMode === 'suggest' ? (
                    <>
                      {/* Suggest Mode */}
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                          <FiTarget className="h-4 w-4 text-muted-foreground" />
                          Find URLs by Topic
                        </Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Describe an industry, company, or role to discover relevant team pages and directories
                        </p>
                        {/* Quick topic chips */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {QUICK_TOPICS.map((topic) => (
                            <button
                              key={topic}
                              onClick={() => setSuggestInput(topic)}
                              className="px-2.5 py-1 rounded-full text-xs bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border transition-all"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., Investment banking analysts at top firms..."
                            value={suggestInput}
                            onChange={(e) => setSuggestInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSuggestUrls()
                              }
                            }}
                            className="bg-white/60 backdrop-blur-sm border-border"
                          />
                          <Button
                            onClick={handleSuggestUrls}
                            disabled={suggestLoading || !suggestInput.trim()}
                            className="shrink-0 gap-1.5"
                          >
                            {suggestLoading ? (
                              <>
                                <FiLoader className="h-4 w-4 animate-spin" />
                                Searching...
                              </>
                            ) : (
                              <>
                                <FiZap className="h-4 w-4" />
                                Suggest URLs
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Suggest error */}
                      {suggestError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 border border-red-200/60">
                          <FiAlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <p className="text-sm text-destructive">{suggestError}</p>
                          <button onClick={() => setSuggestError('')} className="ml-auto text-destructive/60 hover:text-destructive">
                            <FiX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Suggest summary */}
                      {suggestSummary && !Array.isArray(suggestions) && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="text-foreground">{renderMarkdown(suggestSummary)}</div>
                        </div>
                      )}

                      {/* Suggestion Loading State */}
                      {suggestLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={`skel-${i}`} className="bg-white/50 border-border">
                              <CardContent className="p-3 space-y-2">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-4/5" />
                                <Skeleton className="h-5 w-20 mt-1" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Suggestion cards */}
                      {displaySuggestions.length > 0 && !suggestLoading && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <FiZap className="h-3.5 w-3.5 text-muted-foreground" />
                              AI-Suggested URLs
                              <Badge variant="secondary" className="ml-1 text-xs font-normal">{displaySuggestions.length}</Badge>
                            </Label>
                            <Button variant="secondary" size="sm" onClick={addAllSuggestions} className="gap-1 text-xs h-7">
                              <FiPlus className="h-3 w-3" /> Add All
                            </Button>
                          </div>
                          {suggestSummary && suggestions.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                              <p className="text-xs text-muted-foreground">{suggestSummary}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {displaySuggestions.map((s, i) => (
                              <Card key={i} className="bg-white/60 backdrop-blur-sm border-border hover:shadow-md transition-all">
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{s.site_name || 'Website'}</p>
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary/70 hover:text-primary truncate block flex items-center gap-1"
                                      >
                                        <span className="truncate">
                                          {(s.url ?? '').replace(/^https?:\/\//, '').slice(0, 40)}
                                          {(s.url ?? '').length > 48 ? '...' : ''}
                                        </span>
                                        <FiExternalLink className="h-2.5 w-2.5 shrink-0" />
                                      </a>
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description || 'No description'}</p>
                                      {(s.estimated_contacts ?? 0) > 0 && (
                                        <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
                                          ~{s.estimated_contacts} contacts
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => addSuggestionUrl(s.url)}
                                      disabled={urls.includes(s.url)}
                                      className="shrink-0 h-8 w-8 p-0"
                                    >
                                      {urls.includes(s.url) ? <FiCheck className="h-3.5 w-3.5 text-emerald-600" /> : <FiPlus className="h-3.5 w-3.5" />}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Manual Mode */}
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                          <FiGlobe className="h-4 w-4 text-muted-foreground" />
                          Target URLs
                        </Label>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Paste website URLs here, one per line..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                addUrls()
                              }
                            }}
                            rows={3}
                            className="resize-none bg-white/60 backdrop-blur-sm border-border"
                          />
                          <Button onClick={addUrls} variant="secondary" className="self-end shrink-0 h-10 gap-1">
                            <FiPlus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* URL Queue Chips (shared by both modes) */}
                  {urls.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Scraping Queue ({urls.length} URL{urls.length !== 1 ? 's' : ''})
                        </Label>
                        {urls.length > 1 && (
                          <button
                            onClick={() => setUrls([])}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {urls.map((url) => (
                          <Badge
                            key={url}
                            variant="secondary"
                            className="gap-1.5 py-1 px-2.5 text-xs font-normal bg-white/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
                          >
                            <FiLink className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="max-w-[200px] truncate">{url}</span>
                            <button
                              onClick={() => removeUrl(url)}
                              className="ml-1 hover:text-destructive transition-colors"
                            >
                              <FiX className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Field Selection + Scrape CTA */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Extract Fields</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['name', 'email', 'company', 'role'] as const).map((field) => (
                        <div key={field} className="flex items-center gap-2">
                          <Checkbox
                            id={`field-${field}`}
                            checked={fieldToggles[field]}
                            onCheckedChange={(checked) =>
                              setFieldToggles((prev) => ({ ...prev, [field]: checked === true }))
                            }
                          />
                          <Label htmlFor={`field-${field}`} className="text-sm capitalize cursor-pointer">
                            {field}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleScrape}
                    disabled={loading || urls.length === 0}
                    className="w-full gap-2 shadow-md hover:shadow-lg transition-all h-11"
                  >
                    {loading ? (
                      <>
                        <FiLoader className="h-4 w-4 animate-spin" />
                        Researching...
                      </>
                    ) : (
                      <>
                        <FiSearch className="h-4 w-4" />
                        Scrape Contacts
                      </>
                    )}
                  </Button>

                  {urls.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {inputMode === 'suggest'
                        ? 'Use AI to suggest URLs, then add them to the queue'
                        : 'Paste URLs above to get started'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Error Message ───────────────────────── */}
          {errorMsg && (
            <Card className="mb-4 border-destructive/30 bg-red-50/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <FiAlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Research Error</p>
                  <p className="text-sm text-destructive/80 mt-0.5">{errorMsg}</p>
                </div>
                <button
                  onClick={() => setErrorMsg('')}
                  className="ml-auto text-destructive/60 hover:text-destructive transition-colors"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* ── Summary ─────────────────────────────── */}
          {summary && (
            <Card className="mb-4 bg-white/75 backdrop-blur-md border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">
                    <FiCheck className="mr-1 h-3 w-3" />
                    Complete
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {totalFound} contact{totalFound !== 1 ? 's' : ''} found
                  </span>
                </div>
                <div className="text-foreground">{renderMarkdown(summary)}</div>
              </CardContent>
            </Card>
          )}

          {/* ── Results Table ───────────────────────── */}
          <Card className="bg-white/75 backdrop-blur-md border-border shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <FiUsers className="h-4 w-4 text-muted-foreground" />
                  Results
                  {filteredAndSorted.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs font-normal">
                      {filteredAndSorted.length} contact{filteredAndSorted.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm bg-white/60 backdrop-blur-sm border-border"
                  />
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-12 text-center">#</TableHead>
                      {fieldToggles.name && (
                        <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('name')}>
                          <span className="flex items-center gap-1.5">Name <SortIndicator field="name" /></span>
                        </TableHead>
                      )}
                      {fieldToggles.email && (
                        <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('email')}>
                          <span className="flex items-center gap-1.5">Email <SortIndicator field="email" /></span>
                        </TableHead>
                      )}
                      {fieldToggles.company && (
                        <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('company')}>
                          <span className="flex items-center gap-1.5">Company <SortIndicator field="company" /></span>
                        </TableHead>
                      )}
                      {fieldToggles.role && (
                        <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('role')}>
                          <span className="flex items-center gap-1.5">Role <SortIndicator field="role" /></span>
                        </TableHead>
                      )}
                      <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('source_url')}>
                        <span className="flex items-center gap-1.5">Source URL <SortIndicator field="source_url" /></span>
                      </TableHead>
                      <TableHead className="group cursor-pointer select-none" onClick={() => handleSort('status')}>
                        <span className="flex items-center gap-1.5">Status <SortIndicator field="status" /></span>
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <LoadingSkeletonRows count={4} />}
                    {!loading && filteredAndSorted.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={visibleColumnCount} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="p-4 rounded-full bg-muted/40">
                              <FiUsers className="h-8 w-8 opacity-40" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">No contacts scraped yet</p>
                              <p className="text-xs mt-1">Add URLs above and click &quot;Scrape Contacts&quot; to begin</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading &&
                      filteredAndSorted.map((contact, index) => (
                        <TableRow
                          key={contact.id}
                          className={`transition-colors ${(contact.status ?? '').toLowerCase() === 'failed' ? 'bg-red-50/50' : ''}`}
                        >
                          <TableCell className="text-center text-muted-foreground text-xs font-mono">
                            {index + 1}
                          </TableCell>
                          {fieldToggles.name && (
                            <TableCell className="font-medium">
                              <EditableCell
                                value={contact.name}
                                isEditing={editingCell?.rowId === contact.id && editingCell?.field === 'name'}
                                onStartEdit={() => setEditingCell({ rowId: contact.id, field: 'name' })}
                                onFinishEdit={(v) => handleCellEdit(contact.id, 'name', v)}
                              />
                            </TableCell>
                          )}
                          {fieldToggles.email && (
                            <TableCell>
                              <EditableCell
                                value={contact.email}
                                isEditing={editingCell?.rowId === contact.id && editingCell?.field === 'email'}
                                onStartEdit={() => setEditingCell({ rowId: contact.id, field: 'email' })}
                                onFinishEdit={(v) => handleCellEdit(contact.id, 'email', v)}
                              />
                            </TableCell>
                          )}
                          {fieldToggles.company && (
                            <TableCell>
                              <EditableCell
                                value={contact.company}
                                isEditing={editingCell?.rowId === contact.id && editingCell?.field === 'company'}
                                onStartEdit={() => setEditingCell({ rowId: contact.id, field: 'company' })}
                                onFinishEdit={(v) => handleCellEdit(contact.id, 'company', v)}
                              />
                            </TableCell>
                          )}
                          {fieldToggles.role && (
                            <TableCell>
                              <EditableCell
                                value={contact.role}
                                isEditing={editingCell?.rowId === contact.id && editingCell?.field === 'role'}
                                onStartEdit={() => setEditingCell({ rowId: contact.id, field: 'role' })}
                                onFinishEdit={(v) => handleCellEdit(contact.id, 'role', v)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {contact.source_url ? (
                              <a
                                href={contact.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary/70 hover:text-primary underline underline-offset-2 text-sm truncate max-w-[200px] inline-block"
                                title={contact.source_url}
                              >
                                {(() => {
                                  const display = (contact.source_url ?? '').replace(/^https?:\/\//, '')
                                  return display.length > 35 ? display.slice(0, 35) + '...' : display
                                })()}
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic text-sm">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={contact.status} />
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => removeContact(contact.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove contact"
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Agent Status Footer ─────────────────── */}
          <Card className="mt-6 bg-white/60 backdrop-blur-md border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${activeAgent === 'suggest' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <span className="text-xs font-medium text-muted-foreground">URL Suggestion Agent</span>
                  <span className="text-xs text-muted-foreground/50 font-mono">(Perplexity)</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${activeAgent === 'research' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <span className="text-xs font-medium text-muted-foreground">Web Research Agent</span>
                  <span className="text-xs text-muted-foreground/50 font-mono">(Perplexity)</span>
                </div>
                <div className="ml-auto">
                  <span className="text-xs text-muted-foreground">
                    {activeAgent === 'suggest' ? 'Discovering URLs...' : activeAgent === 'research' ? 'Researching contacts...' : 'Idle'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  )
}
