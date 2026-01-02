-- DATABASE: ovos_caipira_db
CREATE DATABASE IF NOT EXISTS ovos_caipira_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ovos_caipira_db;

-- TABELA PRODUTOS
CREATE TABLE produtos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo_ovo ENUM('caipira', 'codorna', 'organico', 'premium') DEFAULT 'caipira',
    tamanho ENUM('P', 'M', 'G', 'GG', 'XL') DEFAULT 'G',
    unidade_por_embalagem INT DEFAULT 12,
    peso_g INT,
    preco_base DECIMAL(10,2) NOT NULL,
    preco_promocional DECIMAL(10,2),
    estoque INT DEFAULT 0,
    estoque_minimo INT DEFAULT 20,
    data_validade DATE,
    perecivel BOOLEAN DEFAULT TRUE,
    imagem_principal VARCHAR(255),
    galeria TEXT, -- JSON array
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tipo_ovo (tipo_ovo),
    INDEX idx_preco (preco_base),
    INDEX idx_estoque (estoque),
    FULLTEXT idx_busca (nome, descricao)
) ENGINE=InnoDB;

-- TABELA ASSINATURAS
CREATE TABLE assinaturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    plano_id INT NOT NULL,
    frequencia ENUM('semanal', 'quinzenal', 'mensal') DEFAULT 'semanal',
    quantidade_caixas INT DEFAULT 1,
    endereco_entrega TEXT NOT NULL,
    dia_entrega ENUM('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado') DEFAULT 'quarta',
    proxima_entrega DATE NOT NULL,
    status ENUM('ativa', 'pausada', 'cancelada', 'suspensa') DEFAULT 'ativa',
    metodo_pagamento ENUM('pix', 'cartao', 'boleto') DEFAULT 'pix',
    ultimo_pagamento DATE,
    proximo_pagamento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_proxima_entrega (proxima_entrega)
);

-- TABELA ENTREGAS
CREATE TABLE entregas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pedido_id INT,
    assinatura_id INT,
    endereco_hash VARCHAR(64) NOT NULL, -- Para privacidade
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    motorista_id INT,
    status ENUM('agendada', 'coletada', 'transito', 'entregue', 'atrasada', 'cancelada') DEFAULT 'agendada',
    temperatura_transporte DECIMAL(4,2), -- Em graus Celsius
    sensor_impacto BOOLEAN DEFAULT FALSE,
    fotos_entrega TEXT, -- JSON array
    assinatura_cliente TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status_data (status, created_at),
    SPATIAL INDEX idx_localizacao (latitude, longitude)
);

-- TABLA SENSORES (IoT Integration)
CREATE TABLE sensores_granja (
    id INT PRIMARY KEY AUTO_INCREMENT,
    granja_id INT NOT NULL,
    sensor_id VARCHAR(50) UNIQUE,
    tipo_sensor ENUM('temperatura', 'umidade', 'movimento', 'postura', 'alimentacao') NOT NULL,
    valor DECIMAL(10,2),
    unidade VARCHAR(20),
    bateria INT DEFAULT 100,
    ultima_leitura TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('online', 'offline', 'alerta') DEFAULT 'online',
    
    INDEX idx_granja_tipo (granja_id, tipo_sensor),
    INDEX idx_leitura (ultima_leitura)
);