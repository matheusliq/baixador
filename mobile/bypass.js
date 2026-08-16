const http = require('http');

// REDIRECIONAMENTO para o Supabase na porta 3001
const supabasePort = 3001;
const supabaseTarget = 'https://supabase.com/dashboard/organizations';

http.createServer(function (req, res) {
  console.log(`[Supabase Redirect] Redirecionando para ${supabaseTarget}`);
  res.writeHead(307, { Location: supabaseTarget });
  res.end();
}).listen(supabasePort, () => {
  console.log(`Porta ${supabasePort} agora redireciona direto para o painel do Supabase`);
});


// REDIRECIONAMENTO para o n8n na porta 3002
const n8nPort = 3002;
const n8nTarget = 'https://n8n.soluxpinturas.shop';

http.createServer(function (req, res) {
  console.log(`[n8n Redirect] Redirecionando para ${n8nTarget}`);
  res.writeHead(307, { Location: n8nTarget });
  res.end();
}).listen(n8nPort, () => {
  console.log(`Porta ${n8nPort} agora redireciona direto para o n8n`);
});
