<?php
// app/Services/PixService.php
class PixService
{
    private $client;
    private $merchant;
    
    public function __construct()
    {
        $this->client = new \GuzzleHttp\Client([
            'base_uri' => 'https://api.pix.gerencianet.com.br/',
            'headers' => [
                'Authorization' => 'Bearer ' . config('services.pix.access_token'),
                'Content-Type' => 'application/json'
            ]
        ]);
    }
    
    /**
     * Gera PIX dinâmico com payload específico para ovos
     */
    public function gerarPixParaOvos($produto, $quantidade, $usuario, $entrega)
    {
        $valorTotal = $produto->preco_base * $quantidade + $entrega->frete;
        
        // Gera chave única baseada nos dados do produto
        $txid = 'OVO' . date('YmdHis') . strtoupper(Str::random(8));
        
        $payload = [
            'calendario' => [
                'expiracao' => 3600 // 1 hora para perecíveis
            ],
            'valor' => [
                'original' => number_format($valorTotal, 2, '.', '')
            ],
            'chave' => config('services.pix.chave'),
            'infoAdicionais' => [
                [
                    'nome' => 'Produto',
                    'valor' => "{$quantidade}x {$produto->nome}"
                ],
                [
                    'nome' => 'Validade',
                    'valor' => $produto->data_validade 
                        ? date('d/m/Y', strtotime($produto->data_validade))
                        : 'Não perecível'
                ],
                [
                    'nome' => 'Entrega',
                    'valor' => date('d/m/Y', strtotime($entrega->data_estimada))
                ],
                [
                    'nome' => 'Granja',
                    'valor' => $produto->granja->nome
                ]
            ]
        ];
        
        try {
            $response = $this->client->post('v2/cob/' . $txid, [
                'json' => $payload
            ]);
            
            $data = json_decode($response->getBody(), true);
            
            // Salva transação no banco
            TransacaoPix::create([
                'txid' => $txid,
                'produto_id' => $produto->id,
                'usuario_id' => $usuario->id,
                'quantidade' => $quantidade,
                'valor' => $valorTotal,
                'qr_code' => $data['qrCode'],
                'imagem_qrcode' => $data['imagemQrcode'],
                'loc_id' => $data['loc']['id'],
                'expira_em' => now()->addHour(),
                'status' => 'pending'
            ]);
            
            return $data;
            
        } catch (\Exception $e) {
            Log::error('Erro gerar PIX: ' . $e->getMessage());
            throw new \Exception('Falha ao gerar pagamento PIX');
        }
    }
    
    /**
     * Webhook para confirmação de pagamento
     * Libera estoque e agenda entrega
     */
    public function webhookConfirmacao(Request $request)
    {
        $webhookData = $request->all();
        $txid = $webhookData['pix'][0]['txid'];
        
        // Busca transação
        $transacao = TransacaoPix::where('txid', $txid)->first();
        
        if ($transacao && $webhookData['pix'][0]['status'] === 'CONCLUIDA') {
            DB::transaction(function () use ($transacao, $webhookData) {
                // Atualiza status
                $transacao->update([
                    'status' => 'paid',
                    'data_pagamento' => now(),
                    'detalhes_pagamento' => json_encode($webhookData)
                ]);
                
                // Agenda entrega imediata (perecível)
                $entrega = Entrega::create([
                    'pedido_id' => $transacao->pedido_id,
                    'produto_id' => $transacao->produto_id,
                    'quantidade' => $transacao->quantidade,
                    'endereco' => $transacao->usuario->endereco_entrega,
                    'data_agendada' => now()->addHours(4), // Entrega urgente
                    'prioridade' => 'alta',
                    'status' => 'agendada'
                ]);
                
                // Notifica granja
                $this->notificarGranja($transacao->produto_id, $transacao->quantidade);
                
                // Envia notificação ao cliente
                $this->enviarWhatsAppConfirmacao($transacao->usuario, $entrega);
            });
            
            return response()->json(['success' => true]);
        }
        
        return response()->json(['success' => false], 400);
    }
}