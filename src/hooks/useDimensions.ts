import { useCallback, useEffect, useState } from 'react'
import { dimensions as fallback } from '../data/bank/index.js'
import { supabase } from '../lib/supabase'
import type { Dimension } from '../lib/types'

let cache: Dimension[] | null = null

const normalize = (d: any): Dimension => ({
  low_threshold: 40, high_threshold: 70, higher_is_better: true, ...d,
})

export function useDimensions() {
  const [dims, setDims] = useState<Dimension[]>(cache || fallback.map(normalize))
  const [loading, setLoading] = useState(!cache)
  const load = useCallback(async () => {
    const { data } = await supabase.from('dimensions').select('*').order('sort')
    if (data && data.length) { cache = data as Dimension[]; setDims(cache) }
    setLoading(false)
  }, [])
  useEffect(() => { if (!cache) load() }, [load])
  const byKey = Object.fromEntries(dims.map((d) => [d.key, d])) as Record<string, Dimension>
  return { dims, byKey, loading, reload: () => { cache = null; return load() } }
}
