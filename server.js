const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ========== CONFIGURAR UPLOAD ==========
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens!'));
  }
});

// ========== CONECTAR BANCO ==========
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// ========== CRIAR TABELAS AUTOMÁTICAS ==========
async function criarTabelas() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS fichas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255),
      passaporte VARCHAR(100),
      crimes TEXT,
      artigos TEXT,
      reducao VARCHAR(10),
      atenuantes TEXT,
      pena VARCHAR(50),
      multa VARCHAR(50),
      fianca_paga VARCHAR(20),
      fianca VARCHAR(255),
      prisao_por_id VARCHAR(100),
      prisao_por VARCHAR(255),
      policiais_ids TEXT,
      policiais TEXT,
      juridico VARCHAR(255),
      relatorio TEXT,
      foto_inv VARCHAR(500),
      foto_mdt VARCHAR(500),
      foto_oab VARCHAR(500),
      foto_rg_mask VARCHAR(500),
      foto_rg VARCHAR(500),
      data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(passaporte),
      INDEX(prisao_por_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS antecedentes (
      id VARCHAR(100) PRIMARY KEY,
      nome VARCHAR(255),
      artigos TEXT,
      total_prisoes INT DEFAULT 0,
      ultima TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS policiais (
      id VARCHAR(100) PRIMARY KEY,
      nome VARCHAR(255),
      total_prisoes INT DEFAULT 0,
      ultima TIMESTAMP
    )
  `);

  console.log('✅ Tabelas criadas!');
}

// ========== ENVIAR PARA DISCORD ==========
async function enviarDiscord(dados, id) {
  try {
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    const form = new FormData();

    const embed = {
      title: '🚨 NOVA FICHA CRIMINAL',
      color: 0x00a651,
      fields: [
        { name: '𝗡𝗢𝗠𝗘', value: dados.nome || '-', inline: true },
        { name: '𝗣𝗔𝗦𝗦𝗔𝗣𝗢𝗥𝗧𝗘', value: dados.passaporte || '-', inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: '𝗔𝗥𝗧𝗜𝗚𝗢𝗦', value: dados.artigos || '-' },
        { name: '𝗖𝗥𝗜𝗠𝗘𝗦', value: dados.crimes || '-' },
        { name: '𝗥𝗘𝗗𝗨𝗖̧𝗔̃𝗢', value: dados.reducao || '0%', inline: true },
        { name: '𝗔𝗧𝗘𝗡𝗨𝗔𝗡𝗧𝗘𝗦', value: dados.atenuantes || 'Nenhum', inline: true },
        { name: '𝗣𝗘𝗡𝗔', value: dados.pena || '0', inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: '𝗠𝗨𝗟𝗧𝗔', value: dados.multa || 'R$ 0,00', inline: true },
        { name: '𝗙𝗜𝗔𝗡𝗖̧𝗔 𝗣𝗔𝗚𝗔', value: dados.fianca_paga || 'Não', inline: true },
        { name: '𝗩𝗔𝗟𝗢𝗥 𝗙𝗜𝗔𝗡𝗖̧𝗔', value: dados.fianca || 'R$ 0,00', inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: '𝗣𝗥𝗜𝗦𝗔̃𝗢 𝗣𝗢𝗥', value: dados.prisao_por || '-', inline: true },
        { name: '𝗣𝗢𝗟𝗜𝗖𝗜𝗔𝗜𝗦', value: dados.policiais || '-', inline: true },
        { name: '𝗝𝗨𝗥𝗜́𝗗𝗜𝗖𝗢', value: dados.juridico || '-', inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: '𝗥𝗘𝗟𝗔𝗧𝗢́𝗥𝗜𝗢', value: dados.relatorio || '-' }
      ],
      footer: { text: `ID: ${id} | ${new Date().toLocaleString('pt-BR')}` },
      timestamp: new Date()
    };

    form.append('payload_json', JSON.stringify({ embeds: [embed] }));

    // Anexar imagens
    const imgs = [
      dados.foto_inv, dados.foto_mdt, dados.foto_oab, 
      dados.foto_rg_mask, dados.foto_rg
    ];

    let i = 0;
    for (const img of imgs) {
      if (img && fs.existsSync(img)) {
        form.append(`files[${i}]`, fs.createReadStream(img), path.basename(img));
        i++;
      }
    }

    const response = await fetch(process.env.DISCORD_WEBHOOK, { 
      method: 'POST', 
      body: form 
    });

    if (!response.ok) {
      throw new Error(`Discord retornou erro: ${response.status}`);
    }

    console.log('✅ Enviado para Discord!');
  } catch (err) {
    console.error('❌ Erro Discord:', err.message);
    throw err; // Propagar erro para o catch principal
  }
}

// ========== ROTA: CRIAR FICHA ==========
app.post('/api/ficha', upload.fields([
  { name: 'foto_inv', maxCount: 1 },
  { name: 'foto_mdt', maxCount: 1 },
  { name: 'foto_oab', maxCount: 1 },
  { name: 'foto_rg_mask', maxCount: 1 },
  { name: 'foto_rg', maxCount: 1 }
]), async (req, res) => {
  try {
    const d = req.body;
    const f = req.files || {};

    const dados = {
      nome: d.nome,
      passaporte: d.passaporte,
      crimes: d.crimes,
      artigos: d.artigos,
      reducao: d.reducao,
      atenuantes: d.atenuantes,
      pena: d.pena,
      multa: d.multa,
      fianca_paga: d.fianca_paga,
      fianca: d.fianca,
      prisao_por_id: d.prisao_por_id,
      prisao_por: d.prisao_por,
      policiais_ids: d.policiais_ids,
      policiais: d.policiais,
      juridico: d.juridico,
      relatorio: d.relatorio,
      foto_inv: f.foto_inv?.[0]?.path || null,
      foto_mdt: f.foto_mdt?.[0]?.path || null,
      foto_oab: f.foto_oab?.[0]?.path || null,
      foto_rg_mask: f.foto_rg_mask?.[0]?.path || null,
      foto_rg: f.foto_rg?.[0]?.path || null
    };

    // Inserir ficha
    const [result] = await db.query(`INSERT INTO fichas SET ?`, dados);
    const fichaId = result.insertId;

    // Atualizar antecedentes DO PRESO - AGORA COM ARTIGOS
    const [existente] = await db.query(
      'SELECT artigos FROM antecedentes WHERE id = ?',
      [d.passaporte]
    );

    let artigosAtualizados = d.artigos || '';
    
    // Se já existem antecedentes, adicionar novos artigos sem duplicar
    if (existente.length > 0 && existente[0].artigos) {
      const artigosAntigos = existente[0].artigos.split(',').map(a => a.trim());
      const artigosNovos = (d.artigos || '').split(',').map(a => a.trim());
      const todosArtigos = [...new Set([...artigosAntigos, ...artigosNovos])];
      artigosAtualizados = todosArtigos.filter(Boolean).join(', ');
    }

    await db.query(`
      INSERT INTO antecedentes (id, nome, artigos, total_prisoes, ultima)
      VALUES (?, ?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE 
        total_prisoes = total_prisoes + 1, 
        artigos = ?,
        ultima = NOW()
    `, [d.passaporte, d.nome, artigosAtualizados, artigosAtualizados]);

    // Atualizar estatísticas DO POLICIAL QUE PRENDEU
    if (d.prisao_por_id && d.prisao_por) {
      await db.query(`
        INSERT INTO policiais (id, nome, total_prisoes, ultima)
        VALUES (?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE total_prisoes = total_prisoes + 1, nome = ?, ultima = NOW()
      `, [d.prisao_por_id, d.prisao_por, d.prisao_por]);
    }

    // Atualizar estatísticas DOS POLICIAIS ENVOLVIDOS
    if (d.policiais_ids && d.policiais) {
      const ids = d.policiais_ids.split(',').map(p => p.trim()).filter(Boolean);
      const nomes = d.policiais.split(',').map(p => p.trim()).filter(Boolean);

      for (let i = 0; i < ids.length; i++) {
        if (ids[i] && nomes[i]) {
          await db.query(`
            INSERT INTO policiais (id, nome, total_prisoes, ultima)
            VALUES (?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE total_prisoes = total_prisoes + 1, nome = ?, ultima = NOW()
          `, [ids[i], nomes[i], nomes[i]]);
        }
      }
    }

    // Enviar Discord
    await enviarDiscord(dados, fichaId);

    res.json({ success: true, id: fichaId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ROTA: BUSCAR ANTECEDENTES POR ID ==========
app.get('/api/antecedentes/:id', async (req, res) => {
  try {
    const [ant] = await db.query(
      'SELECT * FROM antecedentes WHERE id = ?',
      [req.params.id]
    );

    const [fichas] = await db.query(
      'SELECT * FROM fichas WHERE passaporte = ? ORDER BY data DESC',
      [req.params.id]
    );

    if (ant.length === 0) {
      return res.status(404).json({ success: false, msg: 'Sem antecedentes' });
    }

    res.json({ success: true, antecedentes: ant[0], fichas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ROTA: ESTATÍSTICAS POLICIAL POR ID ==========
app.get('/api/policial/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM policiais WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, msg: 'Policial não encontrado' });
    }

    res.json({ success: true, dados: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== INICIAR SERVIDOR ==========
criarTabelas().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`🚀 Servidor: http://localhost:${process.env.PORT}`);
  });
});