import { supabase } from './lib/supabase';
async function debug() {
  const { data: orders } = await supabase.from('ws_orders').select('id, client_id, client_name').limit(5);
  console.log('Orders:', orders);
  const { data: clients } = await supabase.from('ws_clients').select('id, name').limit(5);
  console.log('Clients:', clients);
}
