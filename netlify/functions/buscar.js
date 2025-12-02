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

  try {
    const { tipo, id } = event.queryStringParameters;

    if (!tipo || !id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Parâmetros inválidos' })
      };
    }

    const db = await mysql.createConnection({
      host: 'yamabiko.proxy.rlwy.net',
      port: 22038,
      user: 'root',
      password: 'RjCcrYAtYaUDvDJuqbFbNHWMpFDAXewM',
      database: 'railway'
    });

    let result;

    switch (tipo) {
      case 'antecedentes':
        const [ant] = await db.execute('SELECT * FROM antecedentes WHERE id = ?', [id]);
        if (ant.length === 0) {
          await db.end();
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Nenhum antecedente encontrado' })
          };
        }

        const [fichas] = await db.execute('SELECT * FROM fichas WHERE passaporte = ? ORDER BY data DESC', [id]);
        
        result = {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, antecedentes: ant[0], fichas })
        };
        break;

      case 'ficha':
        const [ficha] = await db.execute('SELECT * FROM fichas WHERE id = ?', [id]);
        if (ficha.length === 0) {
          await db.end();
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Ficha não encontrada' })
          };
        }

        result = {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ficha: ficha[0] })
        };
        break;

      case 'policial':
        const [pol] = await db.execute('SELECT * FROM policiais WHERE id = ?', [id]);
        if (pol.length === 0) {
          await db.end();
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Policial não encontrado' })
          };
        }

        result = {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, policial: pol[0] })
        };
        break;

      default:
        await db.end();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Tipo inválido' })
        };
    }

    await db.end();
    return result;

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};