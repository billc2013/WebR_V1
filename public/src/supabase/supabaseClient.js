// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jdhsebrydbhdbvdtskok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkaHNlYnJ5ZGJoZGJ2ZHRza29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNzg3MzMsImV4cCI6MjA1Mzc1NDczM30.R5CD1BqxanjIMgsS9AK5fqM4n5CC51ZLSAeEFdPipgk';

// Create a single supabase client for the entire app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);