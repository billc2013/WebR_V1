// dbService.js
import { supabase } from './supabaseClient.js';

// Saves a new REPL state entry
export async function saveReplState(user_id, { commandHistory, lastOutput }) {
  const { data, error } = await supabase
    .from('repl_states')
    .insert({
      user_id,
      command_history: commandHistory,
      last_output: lastOutput,
      updated_at: new Date(),
    })
    .select();

  if (error) {
    console.error('Error saving repl state:', error);
    throw error;
  }
  return data;
}

// Loads the most recent REPL state for a user
export async function loadReplState(user_id) {
  const { data, error } = await supabase
    .from('repl_states')
    .select('*')
    .eq('user_id', user_id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error loading repl state:', error);
    throw error;
  }

  // Return the most recent entry, or null if no entries exist
  return data && data.length > 0 ? data[0] : null;
}

// Optional: Get full history for a user
export async function getFullCommandHistory(user_id) {
  const { data, error } = await supabase
    .from('repl_states')
    .select('command_history, updated_at')
    .eq('user_id', user_id)
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('Error loading command history:', error);
    throw error;
  }

  // Combine all command histories into a single array
  const fullHistory = data.reduce((acc, entry) => {
    const commands = JSON.parse(entry.command_history || '[]');
    return [...acc, ...commands];
  }, []);

  return fullHistory;
}