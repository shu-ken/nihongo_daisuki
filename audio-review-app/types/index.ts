export type Question = {
  id: number
  jword: string
  yomi: string
  yomi_kana: string
  category: string
  jlpt_level: string
  word_human_review: boolean
  human_review: boolean
}

export type Example = {
  id: number
  question_id: number
  sort_order: number
  en: string
  ja: string
  romaji: string
  human_review: boolean
}
