import { getSupabase } from './Auth.js';

export async function uploadFile(file, userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from('letters').upload(`${userId}/${file.name}`, file);
  if (error) throw error;
  return data.path;
}

export async function saveDocumentToDatabase(userId, fileName, filePath) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('documents')
    .insert([
      {
        user_id: userId,
        file_name: fileName,
        file_path: filePath
      }
    ])
    .select();
  
  if (error) throw error;
  return data[0];
}

export async function getUserDocuments(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}
