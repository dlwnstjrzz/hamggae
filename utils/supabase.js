import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wgsuffbcecogznkpnorl.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnc3VmZmJjZWNvZ3pua3Bub3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjY1NDYsImV4cCI6MjA4Nzc0MjU0Nn0.QlxGoMB_LDK60KJfq0ZboiPTiTQMmOLycox-Ws2wuVY';

export const supabase = createClient(supabaseUrl, supabaseKey);
