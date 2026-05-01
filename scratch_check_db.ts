
import { supabase } from './src/lib/supabase';

async function checkColumns() {
  const { data, error } = await supabase.from('shifts').select('*').limit(1);
  if (error) {
    console.error('Error fetching shifts:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in shifts table:', Object.keys(data[0]));
  } else {
    console.log('No data in shifts table to check columns.');
  }
}

checkColumns();
