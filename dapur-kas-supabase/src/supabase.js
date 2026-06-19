// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://beogjzmgpadtdzchpuap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ybe-tiz7gcLLVcXjbr_pXA_9AzlcSXt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export default supabase;
