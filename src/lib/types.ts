export type QuestionType = 'cognitive' | 'likert' | 'sjt'
export type SectionType = QuestionType | 'kraepelin'
export type Difficulty = 'mudah' | 'sedang' | 'sulit'
export type DimGroup = 'kognitif' | 'kinerja' | 'kepribadian' | 'validitas'

export interface Dimension {
  key: string
  name: string
  group_name: DimGroup
  description?: string | null
  higher_is_better: boolean
  low_threshold: number
  high_threshold: number
  interp_low?: string | null
  interp_mid?: string | null
  interp_high?: string | null
  color?: string | null
  sort: number
}

export interface QOption {
  id: string
  text: string
  image_url?: string | null
  correct?: boolean
  scores?: Record<string, number>
}

export interface Question {
  id: string
  code: string | null
  type: QuestionType
  category: string
  difficulty: Difficulty
  prompt: string
  stimulus?: string | null
  image_url?: string | null
  options: QOption[]
  explanation?: string | null
  meta: { reverse?: boolean; pair?: string; [k: string]: any }
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface KraepelinConfig {
  columns: number
  rows: number
  seconds_per_column: number
  target_per_column?: number
}

export interface Section {
  id: string
  title: string
  type: SectionType
  description?: string
  instructions?: string
  time_limit_sec?: number | null
  selection?: 'random' | 'manual'
  categories?: string[]
  question_count?: number
  count_per_category?: boolean
  difficulty_counts?: Partial<Record<Difficulty, number>>
  points?: Partial<Record<Difficulty, number>>
  negative_marking?: number
  shuffle_questions?: boolean
  shuffle_options?: boolean
  question_ids?: string[]
  kraepelin?: KraepelinConfig
}

export interface TestSettings {
  allow_back?: boolean
  show_result?: 'none' | 'summary' | 'full'
  max_tab_switches?: number
  auto_submit_on_violation?: boolean
  max_attempts?: number
  require_fields?: string[]
  passing_score?: number
  thresholds?: { sangat?: number; rekomendasi?: number; pertimbangan?: number }
  lie_threshold?: number
  validity_downgrade?: boolean
  min_seconds_per_item?: number
  dimension_weights?: Record<string, number>
  consent_text?: string
}

export interface Test {
  id: string
  title: string
  description?: string | null
  instructions?: string | null
  access_code: string
  is_active: boolean
  starts_at?: string | null
  ends_at?: string | null
  sections: Section[]
  settings: TestSettings
  created_at?: string
  updated_at?: string
}

export interface DimScore {
  pct: number
  raw?: number
  min?: number
  max?: number
  n?: number
  correct?: number
  total?: number
  answered?: number
}

export interface SectionScore {
  index: number
  title: string
  type: SectionType
  total: number
  answered: number
  correct: number
  points: number
  max_points: number
  pct: number | null
}

export interface Flag {
  code: string
  level: 'info' | 'warning' | 'danger'
  message: string
}

export interface KraepelinResult {
  per_column: { answered: number; correct: number }[]
  panker: number
  janker: number
  tianker: number
  hanker: number
  total_answered: number
  total_correct: number
  accuracy: number
}

export interface Attempt {
  id: string
  test_id: string
  token: string
  candidate: Record<string, any>
  candidate_name: string | null
  candidate_email: string | null
  position: string | null
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  updated_at?: string
  duration_sec: number | null
  plan: any[]
  answers: Record<string, string>
  timings: Record<string, number>
  progress: any
  kraepelin: { answers?: Record<string, (number | null)[][]>; results?: Record<string, KraepelinResult> }
  tab_switches: number
  scores: Record<string, DimScore> | null
  section_scores: SectionScore[] | null
  overall_score: number | null
  recommendation: string | null
  passed: boolean | null
  flags: Flag[]
  admin_notes: string | null
  tests?: { title: string; access_code?: string } | null
}

// ---- Payload peserta ----
export interface CandidateQuestion {
  id: string
  type: QuestionType
  prompt: string
  stimulus?: string | null
  image_url?: string | null
  options: { id: string; text: string; image_url?: string | null }[]
}

export interface CandidateSection {
  index: number
  title: string
  type: SectionType
  instructions?: string | null
  time_limit_sec?: number | null
  kraepelin?: { config: KraepelinConfig; columns: number[][] } | null
  questions: CandidateQuestion[]
}

export interface AttemptPayload {
  attempt_id: string
  token: string
  status: 'in_progress' | 'submitted'
  started_at: string
  server_now: string
  candidate: Record<string, any>
  test: { title: string; description?: string; settings: { allow_back: boolean; max_tab_switches: number; auto_submit_on_violation: boolean; show_result: string } }
  answers: Record<string, string>
  timings: Record<string, number>
  progress: RunnerProgress
  kraepelin_answers: Record<string, (number | null)[][]>
  tab_switches: number
  sections: CandidateSection[]
}

export interface RunnerProgress {
  section?: number
  question?: number
  started?: Record<string, number>
  done?: Record<string, boolean>
  flagged?: string[]
  kcol?: Record<string, number>
}
