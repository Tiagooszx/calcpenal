const mysql = require('mysql2/promise');
const busboy = require('busboy');
const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Método não permitido' })
    };
  }

  try {
    // Parse FormData
    const fields = {};
    const files = {};
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Content-Type deve ser multipart/form-data' })
      };
    }

    // Processar FormData com busboy (com limite de tamanho menor)
    await new Promise((resolve, reject) => {
      const bb = busboy({ 
        headers: { 'content-type': contentType },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB por arquivo
          files: 5 // máximo 5 arquivos
        }
      });

      bb.on('field', (name, value) => {
        fields[name] = value;
      });

      bb.on('file', (name, file, info) => {
        const chunks = [];
        let size = 0;
        
        file.on('data', (data) => {
          size += data.length;
          // Limitar a 5MB
          if (size <= 5 * 1024 * 1024) {
            chunks.push(data);
          }
        });
        
        file.on('end', () => {
          if (chunks.length > 0) {
            files[name] = {
              buffer: Buffer.concat(chunks),
              filename: info.filename,
              mimeType: info.mimeType
            };
          }
        });
      });

      bb.on('finish', resolve);
      bb.on('error', reject);

      bb.write(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
      bb.end();
    });

    const db = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'yamabiko.proxy.rlwy.net',
      port: process.env.MYSQL_PORT || 22038,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'RjCcrYAtYaUDvDJuqbFbNHWMpFDAXewM',
      database: process.env.MYSQL_DATABASE || 'railway'
    });

    const {
      nome, passaporte, crimes, artigos, reducao, atenuantes,
      pena, multa, fianca_paga, fianca, prisao_por_id, prisao_por,
      policiais_ids, policiais, juridico, relatorio
    } = fields;

    // Inserir ficha
    const [result] = await db.execute(
      `INSERT INTO fichas (
        nome, passaporte, crimes, artigos, reducao, atenuantes, pena, multa, 
        fianca_paga, fianca, prisao_por_id, prisao_por, policiais_ids, policiais, 
        juridico, relatorio, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nome, passaporte, crimes, artigos, reducao, atenuantes, pena, multa,
       fianca_paga, fianca, prisao_por_id, prisao_por, policiais_ids, policiais,
       juridico, relatorio]
    );

    const id = result.insertId;

    // Atualizar antecedentes
    const [existente] = await db.execute('SELECT artigos FROM antecedentes WHERE id = ?', [passaporte]);
    
    let artigosAtualizados = artigos;
    if (existente.length > 0 && existente[0].artigos) {
      const artigosAntigos = existente[0].artigos.split(',').map(a => a.trim());
      const artigosNovos = artigos.split(',').map(a => a.trim());
      const todosArtigos = [...new Set([...artigosAntigos, ...artigosNovos])];
      artigosAtualizados = todosArtigos.join(', ');
    }

    await db.execute(
      `INSERT INTO antecedentes (id, nome, artigos, total_prisoes, ultima)
       VALUES (?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE 
         total_prisoes = total_prisoes + 1,
         artigos = ?,
         ultima = NOW()`,
      [passaporte, nome, artigosAtualizados, artigosAtualizados]
    );

    // Atualizar policial
    if (prisao_por_id && prisao_por) {
      await db.execute(
        `INSERT INTO policiais (id, nome, total_prisoes, ultima)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE 
           total_prisoes = total_prisoes + 1,
           ultima = NOW()`,
        [prisao_por_id, prisao_por]
      );
    }

    // Atualizar policiais envolvidos
    if (policiais_ids && policiais) {
      const ids = policiais_ids.split(',').map(id => id.trim()).filter(Boolean);
      const nomes = policiais.split('|').map(n => n.split('|')[0].trim()).filter(Boolean);

      for (let i = 0; i < ids.length; i++) {
        if (ids[i] && nomes[i]) {
          await db.execute(
            `INSERT INTO policiais (id, nome, total_prisoes, ultima)
             VALUES (?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE 
               total_prisoes = total_prisoes + 1,
               ultima = NOW()`,
            [ids[i], nomes[i]]
          );
        }
      }
    }

    await db.end();

    // ========== ENVIAR PARA DISCORD (OTIMIZADO) ==========
    const webhookUrl = 'https://discord.com/api/webhooks/1445105953304350832/u-Ewg7eskl3Wm2kvZk7by1qXd-nbSNmEPNjUFOlWy_CyOo6c_Wy1gxSC3P7zriPQq6EY';

    // Formatar mensagem
    const mensagem = `# 𝗙𝗜𝗖𝗛𝗔 𝗖𝗥𝗜𝗠𝗜𝗡𝗔𝗟\n\n` +
      `𝗡𝗢𝗠𝗘 𝗗𝗢 𝗔𝗖𝗨𝗦𝗔𝗗𝗢: ${nome || '-'}\n` +
      `𝗣𝗔𝗦𝗦𝗔𝗣𝗢𝗥𝗧𝗘 𝗗𝗢 𝗔𝗖𝗨𝗦𝗔𝗗𝗢: ${passaporte || '-'}\n\n` +
      `𝗖𝗥𝗜𝗠𝗘𝗦 𝗖𝗢𝗠𝗘𝗧𝗜𝗗𝗢𝗦:\n${crimes || '-'}\n` +
      `𝗥𝗘𝗗𝗨𝗖̧𝗔̃𝗢 𝗔𝗣𝗟𝗜𝗖𝗔𝗗𝗔: ${reducao || '0%'}\n` +
      `𝗔𝗧𝗘𝗡𝗨𝗔𝗡𝗧𝗘𝗦: ${atenuantes || 'Nenhum'}\n` +
      `𝗧𝗢𝗧𝗔𝗟 𝗗𝗔 𝗣𝗘𝗡𝗔: ${pena || '0 meses'}\n\n` +
      `𝗧𝗢𝗧𝗔𝗟 𝗗𝗘 𝗠𝗨𝗟𝗧𝗔: ${multa || 'R$ 0,00'}\n` +
      `𝗙𝗜𝗔𝗡𝗖̧𝗔 𝗣𝗔𝗚𝗔: ${fianca_paga}\n` +
      `𝗧𝗢𝗧𝗔𝗟 𝗗𝗘 𝗙𝗜𝗔𝗡𝗖̧𝗔: ${fianca || 'R$ 0,00'}\n\n` +
      `𝗣𝗥𝗜𝗦𝗔̃𝗢 𝗙𝗘𝗜𝗧𝗔 𝗣𝗢𝗥: ${prisao_por || '-'}\n` +
      `𝗣𝗢𝗟𝗜𝗖𝗜𝗔𝗜𝗦 𝗘𝗡𝗩𝗢𝗟𝗩𝗜𝗗𝗢𝗦: ${policiais || '-'}\n` +
      `𝗝𝗨𝗥𝗜́𝗗𝗜𝗖𝗢 𝗘𝗡𝗩𝗢𝗟𝗩𝗜𝗗𝗢: ${juridico || 'não veio'}\n\n` +
      `𝗥𝗘𝗟𝗔𝗧𝗢́𝗥𝗜𝗢 𝗗𝗔 𝗔𝗖̧𝗔̃𝗢:\n${relatorio || '-'}\n\n` +
      `**ID:** ${id} | ${new Date().toLocaleString('pt-BR')}`;

    // Enviar para Discord usando fetch (mais simples e eficiente)
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('content', mensagem);
    
    // Adicionar arquivos (limitado aos primeiros 10MB total)
    let fileIndex = 0;
    let totalSize = 0;
    const maxTotalSize = 10 * 1024 * 1024; // 10MB total
    
    for (const [key, fileData] of Object.entries(files)) {
      if (fileData && fileData.buffer) {
        const fileSize = fileData.buffer.length;
        
        // Verificar se adicionar este arquivo ultrapassaria o limite
        if (totalSize + fileSize <= maxTotalSize) {
          form.append(`file${fileIndex}`, fileData.buffer, {
            filename: fileData.filename,
            contentType: fileData.mimeType
          });
          totalSize += fileSize;
          fileIndex++;
        } else {
          console.warn(`Arquivo ${fileData.filename} ignorado (limite de tamanho)`);
        }
      }
    }

    // Enviar para Discord
    await new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: form.getHeaders()
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Discord: Mensagem enviada com sucesso!');
            resolve();
          } else {
            console.error('Discord error:', res.statusCode, data);
            resolve(); // Não rejeitar para não bloquear
          }
        });
      });

      req.on('error', (error) => {
        console.error('Discord webhook error:', error);
        resolve(); // Não rejeitar para não bloquear
      });

      form.pipe(req);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        id, 
        message: `Prisão registrada e enviada para Discord com ${fileIndex} imagens!`,
        total_imagens: fileIndex
      })
    };

  } catch (error) {
    console.error('Erro no registrar:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};