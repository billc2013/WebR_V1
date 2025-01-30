// storageService.js
import { supabase } from './supabaseClient.js';

export async function uploadPlot(user_id, fileBlob) {
  const timestamp = new Date().getTime();
  const filePath = `plots/${user_id}/${timestamp}.png`;

  const { data, error } = await supabase.storage
    .from('student-files')
    .upload(filePath, fileBlob);

  if (error) {
    console.error('Error uploading plot:', error);
    throw error;
  }

  // get a public URL or a signed URL
  const { data: urlData } = supabase.storage
    .from('student-files')
    .getPublicUrl(filePath);

  // return the public URL
  return urlData.publicUrl;
}

// For CSV or other user uploads
export async function uploadCSV(user_id, fileBlob, fileName) {
  const filePath = `csv/${user_id}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('student-files')
    .upload(filePath, fileBlob);

  if (error) throw error;

  return data;
}

export async function downloadFile(filePath) {
  // Download the file from storage
  const { data, error } = await supabase.storage
    .from('student-files')
    .download(filePath);

  if (error) throw error;
  return data; // This is a Blob
}
