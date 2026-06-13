'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Question, Example } from '@/types/index'

type AudioState = {
  url: string | null
  loading: boolean
  error: string | null
}

function AudioPlayer({ path }: { path: string }) {
  const [state, setState] = useState<AudioState>({ url: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    async function fetchUrl() {
      const { data, error } = await supabase.storage
        .from('audio')
        .createSignedUrl(path, 3600)
      if (cancelled) return
      if (error || !data) {
        setState({ url: null, loading: false, error: '音声なし' })
      } else {
        setState({ url: data.signedUrl, loading: false, error: null })
      }
    }
    fetchUrl()
    return () => { cancelled = true }
  }, [path])

  if (state.loading) return <p className="text-gray-400 text-sm">読み込み中...</p>
  if (state.error) return <p className="text-gray-400 text-sm">{state.error}</p>
  return (
    <audio
      controls
      src={state.url!}
      className="w-full"
      onError={() => setState(s => ({ ...s, url: null, error: '再生エラーが発生しました' }))}
    />
  )
}

export default function QuestionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [question, setQuestion] = useState<Question | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [loading, setLoading] = useState(true)
  const [allOkLoading, setAllOkLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [{ data: q }, { data: ex }] = await Promise.all([
        supabase.from('questions').select('*').eq('id', id).single(),
        supabase.from('examples').select('*').eq('question_id', id).order('sort_order'),
      ])
      setQuestion(q)
      setExamples(ex ?? [])
      setLoading(false)
    }
    fetchData()
  }, [id])

  const updateWordReview = useCallback(async (checked: boolean) => {
    setQuestion(q => q ? { ...q, word_human_review: checked } : q)
    await supabase.from('questions').update({ word_human_review: checked }).eq('id', id)
  }, [id])

  const updateExampleReview = useCallback(async (exampleId: number, checked: boolean) => {
    setExamples(prev => prev.map(e => e.id === exampleId ? { ...e, human_review: checked } : e))
    await supabase.from('examples').update({ human_review: checked }).eq('id', exampleId)
  }, [])

  const handleAllOk = useCallback(async () => {
    setAllOkLoading(true)
    await Promise.all([
      ...examples.map(e =>
        supabase.from('examples').update({ human_review: true }).eq('id', e.id)
      ),
      supabase.from('questions').update({ human_review: true }).eq('id', id),
    ])
    setExamples(prev => prev.map(e => ({ ...e, human_review: true })))
    setQuestion(q => q ? { ...q, human_review: true } : q)
    setAllOkLoading(false)
  }, [examples, id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">問題が見つかりませんでした</p>
      </div>
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-blue-600 hover:underline text-sm"
        >
          ← 一覧に戻る
        </button>
        <span className={`text-xs px-2 py-1 rounded ${question.human_review ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {question.human_review ? '確認済み' : '未確認'}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{question.jword}</h1>
        <p className="text-gray-500 text-sm mt-1">{question.yomi} / {question.yomi_kana}</p>
        <p className="text-gray-400 text-xs mt-1">{question.category} · {question.jlpt_level}</p>
      </div>

      {/* 単語音声セクション */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-gray-700 border-b pb-2">単語音声</h2>
        <AudioPlayer path={`${id}/word_ja.wav`} />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={question.word_human_review}
            onChange={e => updateWordReview(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">単語音声OK</span>
        </label>
      </section>

      {/* 例文音声セクション */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-semibold text-gray-700">例文音声</h2>
          <button
            onClick={handleAllOk}
            disabled={allOkLoading}
            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {allOkLoading ? '更新中...' : '全てOK'}
          </button>
        </div>

        {examples.length === 0 && (
          <p className="text-gray-400 text-sm">例文がありません</p>
        )}

        {examples.map(example => (
          <div key={example.id} className="space-y-2 pb-4 border-b last:border-b-0">
            <p className="font-medium text-gray-800">{example.ja}</p>
            <p className="text-gray-600 text-sm">{example.en}</p>
            <p className="text-gray-400 text-xs italic">{example.romaji}</p>
            <AudioPlayer path={`${id}/${example.id}_ja.wav`} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={example.human_review}
                onChange={e => updateExampleReview(example.id, e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">例文音声OK</span>
            </label>
          </div>
        ))}
      </section>
    </main>
  )
}
