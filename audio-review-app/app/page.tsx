'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Question, Example } from '@/types/index'

const PAGE_SIZE = 20

type Filters = {
  search: string
  category: string
  jlpt_level: string
  word_human_review: string
  human_review: string
}

type AudioState = { url: string | null; loading: boolean; error: string | null }

function AudioPlayer({ path, reloadKey }: { path: string; reloadKey?: number }) {
  const [state, setState] = useState<AudioState>({ url: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ url: null, loading: true, error: null })
    supabase.storage.from('audio').createSignedUrl(path, 3600).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) setState({ url: null, loading: false, error: '音声なし' })
      else setState({ url: data.signedUrl, loading: false, error: null })
    })
    return () => { cancelled = true }
  }, [path, reloadKey])

  if (state.loading) return <span className="text-gray-400 text-xs">読み込み中…</span>
  if (state.error) return <span className="text-red-400 text-xs">⚠ {state.error}</span>
  return (
    <audio
      controls
      src={state.url!}
      className="h-8 w-full"
      onError={() => setState(s => ({ ...s, url: null, error: '再生エラー' }))}
    />
  )
}

async function toWavBlob(file: File): Promise<Blob> {
  if (/\.wav$/i.test(file.name)) return file
  // AIF/AIFF → サーバーサイドでffmpegを使いWAVに変換
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/convert-to-wav', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`変換失敗: ${res.status}`)
  return res.blob()
}

function UploadZone({ storagePath, onUploaded }: { storagePath: string; onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<{ url: string; blob: Blob; name: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'converting' | 'uploading' | 'ok' | 'err'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const prepare = async (file: File) => {
    setStatus('converting')
    try {
      const blob = await toWavBlob(file)
      const url = URL.createObjectURL(blob)
      setPreview({ url, blob, name: file.name })
      setStatus('idle')
    } catch {
      setStatus('err')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) prepare(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) prepare(file)
    e.target.value = ''
  }

  const handleUpload = async () => {
    if (!preview) return
    setStatus('uploading')
    try {
      const { error } = await supabase.storage
        .from('audio')
        .upload(storagePath, preview.blob, { contentType: 'audio/wav', upsert: true })
      if (error) throw error
      URL.revokeObjectURL(preview.url)
      setPreview(null)
      setStatus('ok')
      onUploaded()
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('err')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setStatus('idle')
  }

  const busy = status === 'converting' || status === 'uploading'

  return (
    <div className="space-y-2">
      {/* ドロップゾーン */}
      {!preview && (
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-1 w-full py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-xs ${
            dragging ? 'border-blue-400 bg-blue-50 text-blue-600' :
            status === 'ok' ? 'border-green-400 bg-green-50 text-green-700' :
            status === 'err' ? 'border-red-400 bg-red-50 text-red-600' :
            busy ? 'border-gray-200 bg-gray-50 text-gray-400' :
            'border-gray-300 bg-white text-gray-500 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".wav,.aif,.aiff,audio/wav,audio/aiff,audio/x-aiff"
            className="hidden"
            onChange={handleFileChange}
            disabled={busy}
          />
          <span className="text-base">
            {status === 'converting' ? '⟳' : status === 'uploading' ? '↑' : status === 'ok' ? '✓' : status === 'err' ? '✗' : '🎵'}
          </span>
          <span>
            {status === 'converting' ? 'WAVに変換中…' :
             status === 'uploading' ? 'アップロード中…' :
             status === 'ok' ? 'アップロード完了' :
             status === 'err' ? 'エラーが発生しました' :
             dragging ? 'ここにドロップ' : 'WAV / AIF をドロップ、またはクリック'}
          </span>
        </label>
      )}

      {/* プレビュー */}
      {preview && (
        <div className="border rounded-lg bg-gray-50 p-3 space-y-2">
          <p className="text-xs text-gray-500 truncate">📄 {preview.name}</p>
          <audio controls src={preview.url} className="h-8 w-full" />
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={busy}
              className="flex-1 text-xs py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'uploading' ? 'アップロード中…' : 'アップロード'}
            </button>
            <button
              onClick={handleCancel}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type ExpandedRowProps = {
  question: Question
  onQuestionUpdate: (updated: Partial<Question>) => void
}

function ExpandedRow({ question, onQuestionUpdate }: ExpandedRowProps) {
  const [examples, setExamples] = useState<Example[]>([])
  const [loadingEx, setLoadingEx] = useState(true)
  const [allOkLoading, setAllOkLoading] = useState(false)
  const [wordReloadKey, setWordReloadKey] = useState(0)
  const [exReloadKeys, setExReloadKeys] = useState<Record<string | number, number>>({})

  useEffect(() => {
    supabase
      .from('examples')
      .select('*')
      .eq('question_id', question.id)
      .order('sort_order')
      .then(({ data }) => {
        setExamples(data ?? [])
        setLoadingEx(false)
      })
  }, [question.id])

  const updateWordReview = async (checked: boolean) => {
    onQuestionUpdate({ word_human_review: checked })
    await supabase.from('questions').update({ word_human_review: checked }).eq('id', question.id)
  }

  const updateExampleReview = async (exId: string | number, checked: boolean) => {
    setExamples(prev => prev.map(e => e.id === exId ? { ...e, human_review: checked } : e))
    await supabase.from('examples').update({ human_review: checked }).eq('id', exId)
  }

  const handleAllOk = async () => {
    setAllOkLoading(true)
    await Promise.all([
      ...examples.map(e => supabase.from('examples').update({ human_review: true }).eq('id', e.id)),
      supabase.from('questions').update({ human_review: true }).eq('id', question.id),
    ])
    setExamples(prev => prev.map(e => ({ ...e, human_review: true })))
    onQuestionUpdate({ human_review: true })
    setAllOkLoading(false)
  }

  return (
    <tr>
      <td colSpan={6} className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="grid grid-cols-1 gap-4">

          {/* 単語音声 */}
          <div className="bg-white rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">単語音声</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={question.word_human_review}
                  onChange={e => updateWordReview(e.target.checked)}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="text-sm text-gray-700">単語OK</span>
              </label>
            </div>
            <AudioPlayer path={`${question.id}/word_ja.wav`} reloadKey={wordReloadKey} />
            <UploadZone
              storagePath={`${question.id}/word_ja.wav`}
              onUploaded={() => setWordReloadKey(k => k + 1)}
            />
          </div>

          {/* 例文音声 */}
          <div className="bg-white rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">例文音声</span>
              <button
                onClick={handleAllOk}
                disabled={allOkLoading}
                className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {allOkLoading ? '更新中…' : '全てOK'}
              </button>
            </div>

            {loadingEx ? (
              <p className="text-gray-400 text-xs">読み込み中…</p>
            ) : examples.length === 0 ? (
              <p className="text-gray-400 text-xs">例文なし</p>
            ) : (
              examples.map(ex => (
                <div key={ex.id} className="flex gap-3 items-start border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{ex.ja}</p>
                    <p className="text-xs text-gray-500 truncate">{ex.en}</p>
                    <AudioPlayer path={`${question.id}/${ex.id}_ja.wav`} reloadKey={exReloadKeys[ex.id] ?? 0} />
                  <UploadZone
                    storagePath={`${question.id}/${ex.id}_ja.wav`}
                    onUploaded={() => setExReloadKeys(prev => ({ ...prev, [ex.id]: (prev[ex.id] ?? 0) + 1 }))}
                  />
                </div>
                  <label className="flex flex-col items-center gap-0.5 cursor-pointer shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={ex.human_review}
                      onChange={e => updateExampleReview(ex.id, e.target.checked)}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-xs text-gray-500">OK</span>
                  </label>
                </div>
              ))
            )}
          </div>

        </div>
      </td>
    </tr>
  )
}

function PromptPanel({ questions }: { questions: Question[] }) {
  const [copied, setCopied] = useState(false)
  const prompt = questions.map(q => q.jword).join('\n')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-amber-800">
          Google AI Studio 音声生成プロンプト（{questions.length}件）
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
        >
          {copied ? 'コピーしました！' : 'コピー'}
        </button>
      </div>
      <textarea
        readOnly
        value={prompt}
        rows={Math.min(questions.length, 10)}
        className="w-full text-sm font-mono bg-white border border-amber-200 rounded px-3 py-2 resize-y text-gray-800"
      />
    </div>
  )
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '',
    jlpt_level: '',
    word_human_review: '',
    human_review: 'false',
  })

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .order('human_review', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filters.search) query = query.ilike('jword', `%${filters.search}%`)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.jlpt_level) query = query.eq('jlpt_level', filters.jlpt_level)
    if (filters.word_human_review !== '') query = query.eq('word_human_review', filters.word_human_review === 'true')
    if (filters.human_review !== '') query = query.eq('human_review', filters.human_review === 'true')

    const { data, count, error } = await query
    if (!error && data) {
      setQuestions(data)
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [page, filters])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
    setExpandedId(null)
  }

  const updateQuestion = (id: string | number, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  const toggleFlag = async (q: Question, field: 'word_human_review' | 'human_review') => {
    const newVal = !q[field]
    updateQuestion(q.id, { [field]: newVal })
    await supabase.from('questions').update({ [field]: newVal }).eq('id', q.id)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">音声確認</h1>

        {/* フィルタ */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="単語で検索..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className="border rounded px-3 py-1.5 text-sm w-40"
          />
          <select value={filters.category} onChange={e => handleFilterChange('category', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
            <option value="">カテゴリ（全て）</option>
            <option value="noun">noun</option>
            <option value="verb">verb</option>
            <option value="adjective">adjective</option>
            <option value="adverb">adverb</option>
            <option value="expression">expression</option>
            <option value="nature">nature</option>
            <option value="people">people</option>
            <option value="time">time</option>
            <option value="entertainment">entertainment</option>
            <option value="emotion">emotion</option>
          </select>
          <select value={filters.jlpt_level} onChange={e => handleFilterChange('jlpt_level', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
            <option value="">JLPTレベル（全て）</option>
            <option value="N1">N1</option>
            <option value="N2">N2</option>
            <option value="N3">N3</option>
            <option value="N4">N4</option>
            <option value="N5">N5</option>
          </select>
          <select value={filters.word_human_review} onChange={e => handleFilterChange('word_human_review', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
            <option value="">単語レビュー（全て）</option>
            <option value="false">未確認</option>
            <option value="true">確認済み</option>
          </select>
          <select value={filters.human_review} onChange={e => handleFilterChange('human_review', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
            <option value="">例文レビュー（全て）</option>
            <option value="false">未確認</option>
            <option value="true">確認済み</option>
          </select>
          <button
            onClick={() => setShowPrompt(p => !p)}
            className={`ml-auto text-sm px-3 py-1.5 rounded border transition-colors ${showPrompt ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            📋 プロンプト生成
          </button>
        </div>

        {/* プロンプトパネル */}
        {showPrompt && !loading && (
          <PromptPanel questions={questions} />
        )}

        {/* テーブル */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">単語</th>
                <th className="px-4 py-3 text-left">読み</th>
                <th className="px-4 py-3 text-left">カテゴリ</th>
                <th className="px-4 py-3 text-left">JLPT</th>
                <th className="px-4 py-3 text-center">単語</th>
                <th className="px-4 py-3 text-center">例文</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">読み込み中...</td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">データがありません</td>
                </tr>
              ) : (
                questions.map(q => {
                  const isOpen = expandedId === q.id
                  return (
                    <React.Fragment key={q.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : q.id)}
                        className={`cursor-pointer transition-colors border-t border-gray-100 ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <span className="mr-1 text-gray-400">{isOpen ? '▾' : '▸'}</span>
                          {q.jword}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{q.yomi}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{q.category}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{q.jlpt_level}</td>
                        <td className="px-4 py-3 text-center" onClick={e => { e.stopPropagation(); toggleFlag(q, 'word_human_review') }}>
                          <input
                            type="checkbox"
                            checked={q.word_human_review}
                            onChange={() => {}}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => { e.stopPropagation(); toggleFlag(q, 'human_review') }}>
                          <input
                            type="checkbox"
                            checked={q.human_review}
                            onChange={() => {}}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <ExpandedRow
                          key={`${q.id}-expanded`}
                          question={q}
                          onQuestionUpdate={patch => updateQuestion(q.id, patch)}
                        />
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            全 {total} 件 / {totalPages} ページ中 {page + 1} ページ目
          </span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => Math.max(0, p - 1)); setExpandedId(null) }} disabled={page === 0} className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">前へ</button>
            <button onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); setExpandedId(null) }} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">次へ</button>
          </div>
        </div>
      </div>
    </main>
  )
}
