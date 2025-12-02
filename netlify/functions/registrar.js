const mysql = require('mysql2/promise');
const busboy = require('busboy');

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
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Content-Type deve ser multipart/form-data' })
      };
    }

    await new Promise((resolve, reject) => {
      const bb = busboy({ headers: { 'content-type': contentType } });

      bb.on('field', (name, value) => {
        fields[name] = value;
      });

      bb.on('file', (name, file) => {
        file.resume(); // Ignorar arquivos
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
      policiais_ids, policiais, juridico, relatorio,
      foto_inv, foto_mdt, foto_oab, foto_rg_mask, foto_rg
    } = fields;

    // Inserir ficha COM URLS DAS IMAGENS
    const [result] = await db.execute(
      `INSERT INTO fichas (
        nome, passaporte, crimes, artigos, reducao, atenuantes, pena, multa, 
        fianca_paga, fianca, prisao_por_id, prisao_por, policiais_ids, policiais, 
        juridico, relatorio, foto_inv, foto_mdt, foto_oab, foto_rg_mask, foto_rg, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nome, passaporte, crimes, artigos, reducao, atenuantes, pena, multa,
       fianca_paga, fianca, prisao_por_id, prisao_por, policiais_ids, policiais,
       juridico, relatorio, foto_inv || null, foto_mdt || null, foto_oab || null, 
       foto_rg_mask || null, foto_rg || null]
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        id, 
        message: 'Prisão registrada com sucesso!'
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