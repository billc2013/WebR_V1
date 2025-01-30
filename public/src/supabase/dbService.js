// dbService.js
import { supabase } from './supabaseClient.js';

// Saves or updates the REPL state
export async function saveReplState(user_id, { commandHistory, lastOutput }) {
  // Upsert logic: if row not found, create it
  // otherwise update it. 
  // This is just an example; you might want more advanced logic
  const { data, error } = await supabase
    .from('repl_states')
    .upsert({
      user_id,
      command_history: commandHistory,
      last_output: lastOutput,
      updated_at: new Date(),
    })
    .select()
    .single(); // return the single row

  if (error) {
    console.error('Error saving repl state:', error);
    throw error;
  }
  return data;
}

export async function loadReplState(user_id) {
  const { data, error } = await supabase
    .from('repl_states')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // 'PGRST116' = No rows
    console.error('Error loading repl state:', error);
    throw error;
  }
  return data;
}
