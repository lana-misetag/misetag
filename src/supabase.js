import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aklptqxgvbertqwgdjoz.supabase.co'
const supabaseKey = 'sb_publishable_1d2nbiC-0NMv25Txm-EWGQ_ub5N540T'

export const supabase = createClient(supabaseUrl, supabaseKey)
