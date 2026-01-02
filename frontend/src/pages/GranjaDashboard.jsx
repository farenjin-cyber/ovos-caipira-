// src/pages/GranjaDashboard.jsx
import React, { useEffect, useState } from 'react';
import { 
  Thermometer, 
  Droplets, 
  Egg, 
  Activity,
  Truck,
  AlertTriangle 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const GranjaDashboard = ({ granjaId }) => {
  const [sensores, setSensores] = useState([]);
  const [pedidosHoje, setPedidosHoje] = useState(0);
  const [alertas, setAlertas] = useState([]);
  
  useEffect(() => {
    // WebSocket para dados em tempo real
    const ws = new WebSocket(`wss://api.ovoscaipira.com.br/granja/${granjaId}/ws`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'sensor_update') {
        setSensores(prev => {
          const updated = [...prev];
          const index = updated.findIndex(s => s.sensor_id === data.sensor_id);
          if (index !== -1) {
            updated[index] = { ...updated[index], ...data };
          } else {
            updated.push(data);
          }
          return updated;
        });
      }
      
      if (data.type === 'alerta') {
        setAlertas(prev => [data, ...prev.slice(0, 9)]);
        
        // Notificação push
        if (Notification.permission === 'granted') {
          new Notification('Alerta Granja', {
            body: data.mensagem,
            icon: '/logo.png'
          });
        }
      }
    };
    
    // Carrega dados iniciais
    fetch(`/api/granja/${granjaId}/dashboard`)
      .then(res => res.json())
      .then(data => {
        setSensores(data.sensores);
        setPedidosHoje(data.pedidos_hoje);
      });
      
    return () => ws.close();
  }, [granjaId]);
  
  // Calcula produção estimada
  const producaoEstimada = sensores
    .filter(s => s.tipo_sensor === 'postura')
    .reduce((acc, sensor) => acc + (sensor.valor || 0), 0);
  
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Granja #{granjaId}</h1>
      
      {/* Alertas em tempo real */}
      {alertas.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {alertas.map((alerta, index) => (
            <div key={index} className={`p-4 rounded-lg ${
              alerta.nivel === 'critico' ? 'bg-red-100 border-l-4 border-red-500' :
              alerta.nivel === 'alerta' ? 'bg-yellow-100 border-l-4 border-yellow-500' :
              'bg-blue-100 border-l-4 border-blue-500'
            }`}>
              <div className="flex items-center">
                <AlertTriangle className={`w-5 h-5 mr-2 ${
                  alerta.nivel === 'critico' ? 'text-red-600' :
                  alerta.nivel === 'alerta' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <span className="font-semibold">{alerta.titulo}</span>
              </div>
              <p className="text-sm mt-1">{alerta.mensagem}</p>
              <span className="text-xs text-gray-500 mt-2 block">
                {new Date(alerta.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center">
            <Egg className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Produção Hoje</p>
              <p className="text-2xl font-bold">{producaoEstimada} ovos</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center">
            <Thermometer className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Temperatura</p>
              <p className="text-2xl font-bold">
                {sensores.find(s => s.tipo_sensor === 'temperatura')?.valor || '--'}°C
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center">
            <Truck className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Pedidos Hoje</p>
              <p className="text-2xl font-bold">{pedidosHoje}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Eficiência</p>
              <p className="text-2xl font-bold">94%</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gráfico Produção */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">Produção Últimas 24h</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hora" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="ovos" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Sensores em Tempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-semibold mb-4">Sensores Ativos</h3>
          <div className="space-y-3">
            {sensores.map(sensor => (
              <div key={sensor.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center">
                  {sensor.tipo_sensor === 'temperatura' && <Thermometer className="w-5 h-5 mr-3 text-red-500" />}
                  {sensor.tipo_sensor === 'umidade' && <Droplets className="w-5 h-5 mr-3 text-blue-500" />}
                  {sensor.tipo_sensor === 'postura' && <Egg className="w-5 h-5 mr-3 text-green-500" />}
                  <div>
                    <p className="font-medium capitalize">{sensor.tipo_sensor}</p>
                    <p className="text-sm text-gray-500">ID: {sensor.sensor_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{sensor.valor || 0} {sensor.unidade}</p>
                  <p className={`text-xs ${
                    sensor.status === 'online' ? 'text-green-600' : 
                    sensor.status === 'alerta' ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {sensor.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Próximas Entregas */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-semibold mb-4">Próximas Entregas</h3>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Cliente #{1234 + i}</p>
                    <p className="text-sm text-gray-500">3 caixas • Ovos Caipira G</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700">R$ 45,90</p>
                    <p className="text-xs text-gray-500">14:30 - 16:30</p>
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Truck className="w-4 h-4 mr-1 text-blue-500" />
                  <span className="text-gray-600">Em rota • 3.2km</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};