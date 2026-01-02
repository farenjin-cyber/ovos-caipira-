<?php
// app/Http/Controllers/Api/ProdutoController.php
namespace App\Http\Controllers\Api;

use App\Models\Produto;
use App\Models\Estoque;
use App\Services\PerecivelService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ProdutoController extends Controller
{
    private $perecivelService;
    
    public function __construct(PerecivelService $perecivelService)
    {
        $this->perecivelService = $perecivelService;
    }
    
    /**
     * GET /api/produtos/disponiveis
     * Retorna produtos com estoque válido e dentro da validade
     */
    public function disponiveis(Request $request)
    {
        $cacheKey = 'produtos_disponiveis_' . md5(serialize($request->all()));
        
        return Cache::remember($cacheKey, 300, function () use ($request) {
            $query = Produto::with(['granja', 'avaliacoes'])
                ->where('ativo', true)
                ->where('estoque', '>', 0)
                ->where(function($q) {
                    $q->whereNull('data_validade')
                      ->orWhere('data_validade', '>', now()->addDays(2));
                });
            
            // Filtros
            if ($request->has('tipo')) {
                $query->where('tipo_ovo', $request->tipo);
            }
            
            if ($request->has('preco_max')) {
                $query->where('preco_base', '<=', $request->preco_max);
            }
            
            // Ordenação por frescor (validade mais próxima primeiro)
            $query->orderByRaw('ISNULL(data_validade), data_validade ASC')
                  ->orderBy('created_at', 'DESC');
            
            return response()->json([
                'success' => true,
                'data' => $query->paginate(12),
                'meta' => [
                    'estoque_total' => Produto::sum('estoque'),
                    'produtos_pereciveis' => $this->perecivelService->alertasValidade()
                ]
            ]);
        });
    }
    
    /**
     * POST /api/produtos/{id}/comprar
     * Processa compra com validação de perecibilidade
     */
    public function comprar(Request $request, $id)
    {
        $produto = Produto::findOrFail($id);
        $quantidade = $request->input('quantidade', 1);
        
        // Validação de perecibilidade
        $validadeCheck = $this->perecivelService->verificarValidadeEntrega(
            $produto, 
            $quantidade,
            $request->input('cep_destino')
        );
        
        if (!$validadeCheck['disponivel']) {
            return response()->json([
                'success' => false,
                'message' => 'Produto não disponível para entrega no prazo necessário',
                'alternativas' => $validadeCheck['alternativas']
            ], 400);
        }
        
        // Reserva estoque
        DB::transaction(function () use ($produto, $quantidade) {
            $produto->estoque -= $quantidade;
            $produto->save();
            
            // Log reserva
            Estoque::create([
                'produto_id' => $produto->id,
                'tipo' => 'saida',
                'quantidade' => $quantidade,
                'motivo' => 'venda_online',
                'saldo' => $produto->estoque
            ]);
        });
        
        return response()->json([
            'success' => true,
            'reserva_id' => Str::uuid(),
            'valido_ate' => now()->addMinutes(30),
            'instrucoes_pagamento' => $this->gerarPixDinamico($produto, $quantidade)
        ]);
    }
}

// app/Services/PerecivelService.php
class PerecivelService
{
    public function verificarValidadeEntrega($produto, $quantidade, $cepDestino)
    {
        $dataAtual = now();
        $dataEntregaEstimada = $this->calcularEntrega($cepDestino);
        
        // Produto vence antes da entrega?
        if ($produto->data_validade && $produto->data_validade < $dataEntregaEstimada) {
            return [
                'disponivel' => false,
                'motivo' => 'validade_insuficiente',
                'data_validade' => $produto->data_validade,
                'data_entrega' => $dataEntregaEstimada,
                'alternativas' => $this->sugerirAlternativas($produto)
            ];
        }
        
        // Tem estoque suficiente considerando margem de segurança?
        $estoqueSeguro = $produto->estoque - $produto->estoque_minimo;
        if ($quantidade > $estoqueSeguro) {
            return [
                'disponivel' => false,
                'motivo' => 'estoque_insuficiente',
                'estoque_atual' => $produto->estoque,
                'quantidade_solicitada' => $quantidade,
                'alternativas' => $this->sugerirProximaEntrega($produto)
            ];
        }
        
        return [
            'disponivel' => true,
            'data_entrega' => $dataEntregaEstimada,
            'janela_entrega' => '4 horas',
            'recomendacao' => 'Manter refrigerado após recebimento'
        ];
    }
    
    private function calcularEntrega($cep)
    {
        // Integração com API de logística
        $logistica = app(LogisticaService::class);
        return $logistica->estimativaEntrega($cep);
    }
}