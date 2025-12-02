const mysql = require('mysql2/promise');

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
    // Parse do body (vem como base64 do FormData)
    const body = JSON.parse(event.body);

    const db = await mysql.createConnection({
      host: 'yamabiko.proxy.rlwy.net',
      port: 22038,
      user: 'root',
      password: 'RjCcrYAtYaUDvDJuqbFbNHWMpFDAXewM',
      database: 'railway'
    });

    const {
      nome, passaporte, crimes, artigos, reducao, atenuantes,
      pena, multa, fianca_paga, fianca, prisao_por_id, prisao_por,
      policiais_ids, policiais, juridico, relatorio
    } = body;

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

    await db.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id, message: 'Prisão registrada!' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};