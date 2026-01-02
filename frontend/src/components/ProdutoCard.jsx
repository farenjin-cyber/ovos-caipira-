// src/components/ProdutoCard.jsx
import React, { useState } from 'react';
import { ShoppingCart, Clock, Shield, Truck } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { formatPrice, calculateValidade } from '../utils/helpers';
import ValidadeCountdown from './ValidadeCountdown';

const ProdutoCard = ({ produto }) => {
  const { addToCart, reservarProduto } = useCart();
  const [quantidade, setQuantidade] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validadeInfo, setValidadeInfo] = useState(null);

  const checkValidade = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/produtos/${produto.id}/validade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade, cep: localStorage.getItem('userCep') })
      });
      const data = await response.json();
      setValidadeInfo(data);
    } catch (error) {
      console.error('Erro ao verificar validade:', error);
    }
    setLoading(false);
  };

  const handleAddToCart = async () => {
    if (produto.perecivel) {
      await checkValidade();
      if (!validadeInfo?.disponivel) {
        alert(validadeInfo.mensagem);
        return;
      }
    }
    
    const reserva = await reservarProduto(produto.id, quantidade);
    if (reserva.success) {
      addToCart({ ...produto, quantidade, reserva_id: reserva.id });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-green-100 hover:shadow-xl transition-shadow duration-300">
      {/* Badge Frescor */}
      {produto.data_validade && (
        <div className="absolute top-2 left-2 z-10">
          <ValidadeCountdown dataValidade={produto.data_validade} />
        </div>
      )}
      
      {/* Imagem */}
      <div className="relative h-48 overflow-hidden">
        <img 
          src={produto.imagem_principal} 
          alt={produto.nome}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
        {produto.estoque <= produto.estoque_minimo && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
            ÚLTIMAS UNIDADES
          </div>
        )}
      </div>
      
      {/* Informações */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-gray-800">{produto.nome}</h3>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
            {produto.tipo_ovo.toUpperCase()}
          </span>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {produto.descricao}
        </p>
        
        {/* Info Granja */}
        {produto.granja && (
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <Shield className="w-4 h-4 mr-1 text-green-600" />
            <span>Granja {produto.granja.nome} • {produto.granja.distancia_km}km</span>
          </div>
        )}
        
        {/* Validade */}
        {produto.data_validade && (
          <div className="flex items-center text-sm text-amber-600 mb-3">
            <Clock className="w-4 h-4 mr-1" />
            <span>Válido até: {new Date(produto.data_validade).toLocaleDateString()}</span>
          </div>
        )}
        
        {/* Preço */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-2xl font-bold text-green-700">
              {formatPrice(produto.preco_base)}
            </span>
            <span className="text-gray-500 text-sm ml-2">
              /caixa com {produto.unidade_por_embalagem} unidades
            </span>
          </div>
          
          {produto.perecivel && (
            <div className="text-xs text-gray-500 flex items-center">
              <Truck className="w-3 h-3 mr-1" />
              Entrega 24-48h
            </div>
          )}
        </div>
        
        {/* Controles */}
        <div className="flex space-x-2">
          <div className="flex-1">
            <select 
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center"
            >
              {[1,2,3,4,5,6].map(num => (
                <option key={num} value={num}>
                  {num} caixa{num > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleAddToCart}
            disabled={loading || produto.estoque === 0}
            className={`flex-1 flex items-center justify-center gap-2 ${
              produto.estoque === 0 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white font-bold py-2 px-4 rounded-lg transition-colors`}
          >
            <ShoppingCart className="w-5 h-5" />
            {loading ? 'Verificando...' : produto.estoque === 0 ? 'ESGOTADO' : 'COMPRAR'}
          </button>
        </div>
        
        {/* Assinatura rápida */}
        <button className="w-full mt-3 text-center text-green-700 hover:text-green-800 text-sm font-semibold border border-green-200 rounded-lg py-2 hover:bg-green-50 transition-colors">
          📅 ASSINAR ENTREGA SEMANAL (15% OFF)
        </button>
      </div>
    </div>
  );
};

export default ProdutoCard;