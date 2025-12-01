<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

try {
    // CONEXÃO RAILWAY
    $db = new PDO(
        'mysql:host=yamabiko.proxy.rlwy.net;port=22038;dbname=railway;charset=utf8mb4',
        'root',
        'RjCcrYAtYaUDvDJuqbFbNHWMpFDAXewM'
    );
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Coletar dados do POST
    $nome = $_POST['nome'] ?? '';
    $passaporte = $_POST['passaporte'] ?? '';
    $crimes = $_POST['crimes'] ?? '';
    $artigos = $_POST['artigos'] ?? '';
    $reducao = $_POST['reducao'] ?? '';
    $atenuantes = $_POST['atenuantes'] ?? '';
    $pena = $_POST['pena'] ?? '';
    $multa = $_POST['multa'] ?? '';
    
    // CORREÇÃO: Garantir que fianca_paga seja apenas "Sim" ou "Não"
    $fiancaPagaRaw = $_POST['fianca_paga'] ?? 'Não';
    $fianca_paga = (stripos($fiancaPagaRaw, 'sim') !== false) ? 'Sim' : 'Não';
    
    $fianca = $_POST['fianca'] ?? '';
    $prisao_por_id = $_POST['prisao_por_id'] ?? '';
    $prisao_por = $_POST['prisao_por'] ?? '';
    $policiais_ids = $_POST['policiais_ids'] ?? '';
    $policiais = $_POST['policiais'] ?? '';
    $juridico = $_POST['juridico'] ?? '';
    $relatorio = $_POST['relatorio'] ?? '';

    // Processar uploads de imagens
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fotos = [];
    $fotosCompletas = [];
    $allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];

    foreach (['foto_inventario', 'foto_mdt', 'foto_oab', 'foto_rg_mask', 'foto_rg'] as $key) {
        if (isset($_FILES[$key]) && $_FILES[$key]['error'] === UPLOAD_ERR_OK) {
            $fileType = $_FILES[$key]['type'];
            
            if (!in_array($fileType, $allowedTypes)) {
                throw new Exception("Tipo de arquivo não permitido: $key");
            }

            $extension = pathinfo($_FILES[$key]['name'], PATHINFO_EXTENSION);
            $filename = uniqid() . '_' . time() . '.' . $extension;
            $filepath = $uploadDir . $filename;

            if (move_uploaded_file($_FILES[$key]['tmp_name'], $filepath)) {
                $fotos[$key] = 'uploads/' . $filename;
                $fotosCompletas[] = $filepath;
            }
        } else {
            $fotos[$key] = null;
        }
    }

    // Inserir no banco de dados
    $sql = "INSERT INTO fichas (
        nome, passaporte, crimes, artigos, reducao, atenuantes, pena, multa, 
        fianca_paga, fianca, prisao_por_id, prisao_por, policiais_ids, policiais, 
        juridico, relatorio, foto_inv, foto_mdt, foto_oab, foto_rg_mask, foto_rg, 
        data
    ) VALUES (
        :nome, :passaporte, :crimes, :artigos, :reducao, :atenuantes, :pena, :multa,
        :fianca_paga, :fianca, :prisao_por_id, :prisao_por, :policiais_ids, :policiais,
        :juridico, :relatorio, :foto_inv, :foto_mdt, :foto_oab, :foto_rg_mask, :foto_rg,
        NOW()
    )";

    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':nome' => $nome,
        ':passaporte' => $passaporte,
        ':crimes' => $crimes,
        ':artigos' => $artigos,
        ':reducao' => $reducao,
        ':atenuantes' => $atenuantes,
        ':pena' => $pena,
        ':multa' => $multa,
        ':fianca_paga' => $fianca_paga, // CORRIGIDO: apenas "Sim" ou "Não"
        ':fianca' => $fianca,
        ':prisao_por_id' => $prisao_por_id,
        ':prisao_por' => $prisao_por,
        ':policiais_ids' => $policiais_ids,
        ':policiais' => $policiais,
        ':juridico' => $juridico,
        ':relatorio' => $relatorio,
        ':foto_inv' => $fotos['foto_inventario'],
        ':foto_mdt' => $fotos['foto_mdt'],
        ':foto_oab' => $fotos['foto_oab'],
        ':foto_rg_mask' => $fotos['foto_rg_mask'],
        ':foto_rg' => $fotos['foto_rg']
    ]);

    $id = $db->lastInsertId();

    // Atualizar antecedentes
    $artigosAtualizados = $artigos;
    $existente = $db->query("SELECT artigos FROM antecedentes WHERE id = " . $db->quote($passaporte))->fetch();
    
    if ($existente) {
        $artigosAntigos = array_map('trim', explode(',', $existente['artigos']));
        $artigosNovos = array_map('trim', explode(',', $artigos));
        $todosArtigos = array_unique(array_merge($artigosAntigos, $artigosNovos));
        $artigosAtualizados = implode(', ', array_filter($todosArtigos));
    }

    $stmtAnt = $db->prepare("
        INSERT INTO antecedentes (id, nome, artigos, total_prisoes, ultima)
        VALUES (:id, :nome, :artigos, 1, NOW())
        ON DUPLICATE KEY UPDATE 
            total_prisoes = total_prisoes + 1,
            artigos = :artigos2,
            ultima = NOW()
    ");
    $stmtAnt->execute([
        ':id' => $passaporte,
        ':nome' => $nome,
        ':artigos' => $artigosAtualizados,
        ':artigos2' => $artigosAtualizados
    ]);

    // Atualizar policial que prendeu
    if ($prisao_por_id && $prisao_por) {
        $stmtPol = $db->prepare("
            INSERT INTO policiais (id, nome, total_prisoes, ultima)
            VALUES (:id, :nome, 1, NOW())
            ON DUPLICATE KEY UPDATE 
                total_prisoes = total_prisoes + 1,
                nome = :nome2,
                ultima = NOW()
        ");
        $stmtPol->execute([
            ':id' => $prisao_por_id,
            ':nome' => $prisao_por,
            ':nome2' => $prisao_por
        ]);
    }

    // Atualizar policiais envolvidos
    if ($policiais_ids && $policiais) {
        $ids = array_map('trim', explode(',', $policiais_ids));
        $nomes = array_map('trim', explode(',', $policiais));

        for ($i = 0; $i < count($ids); $i++) {
            if (isset($ids[$i]) && isset($nomes[$i])) {
                $stmtPolEnv = $db->prepare("
                    INSERT INTO policiais (id, nome, total_prisoes, ultima)
                    VALUES (:id, :nome, 1, NOW())
                    ON DUPLICATE KEY UPDATE 
                        total_prisoes = total_prisoes + 1,
                        nome = :nome2,
                        ultima = NOW()
                ");
                $stmtPolEnv->execute([
                    ':id' => $ids[$i],
                    ':nome' => $nomes[$i],
                    ':nome2' => $nomes[$i]
                ]);
            }
        }
    }

    // ========== ENVIAR PARA DISCORD COM TODAS AS IMAGENS =========
    $webhookUrl = 'https://discord.com/api/webhooks/1445105953304350832/u-Ewg7eskl3Wm2kvZk7by1qXd-nbSNmEPNjUFOlWy_CyOo6c_Wy1gxSC3P7zriPQq6EY';

    // Formatar mensagem
    $mensagem = "# 𝗙𝗜𝗖𝗛𝗔 𝗖𝗥𝗜𝗠𝗜𝗡𝗔𝗟\n\n";
    $mensagem .= "𝗡𝗢𝗠𝗘 𝗗𝗢 𝗔𝗖𝗨𝗦𝗔𝗗𝗢: " . ($nome ?: '-') . "\n";
    $mensagem .= "𝗣𝗔𝗦𝗦𝗔𝗣𝗢𝗥𝗧𝗘 𝗗𝗢 𝗔𝗖𝗨𝗦𝗔𝗗𝗢: " . ($passaporte ?: '-') . "\n\n";
    $mensagem .= "𝗖𝗥𝗜𝗠𝗘𝗦 𝗖𝗢𝗠𝗘𝗧𝗜𝗗𝗢𝗦:\n" . ($crimes ?: '-') . "\n";
    $mensagem .= "𝗥𝗘𝗗𝗨𝗖̧𝗔̃𝗢 𝗔𝗣𝗟𝗜𝗖𝗔𝗗𝗔: " . ($reducao ?: '0%') . "\n";
    $mensagem .= "𝗔𝗧𝗘𝗡𝗨𝗔𝗡𝗧𝗘𝗦: " . ($atenuantes ?: 'Nenhum') . "\n";
    $mensagem .= "𝗧𝗢𝗧𝗔𝗟 𝗗𝗔 𝗣𝗘𝗡𝗔: " . ($pena ?: '0 meses') . "\n\n";
    $mensagem .= "𝗧𝗢𝗧𝗔𝗟 𝗗𝗘 𝗠𝗨𝗟𝗧𝗔: " . ($multa ?: 'R$ 0,00') . "\n";
    $mensagem .= "𝗙𝗜𝗔𝗡𝗖̧𝗔 𝗣𝗔𝗚𝗔: " . ($fianca_paga) . "\n";
    $mensagem .= "𝗧𝗢𝗧𝗔𝗟 𝗗𝗘 𝗙𝗜𝗔𝗡𝗖̧𝗔: " . ($fianca ?: 'R$ 0,00') . "\n\n";
    $mensagem .= "𝗣𝗥𝗜𝗦𝗔̃𝗢 𝗙𝗘𝗜𝗧𝗔 𝗣𝗢𝗥: " . ($prisao_por ?: '-') . "\n";
    $mensagem .= "𝗣𝗢𝗟𝗜𝗖𝗜𝗔𝗜𝗦 𝗘𝗡𝗩𝗢𝗟𝗩𝗜𝗗𝗢𝗦: " . ($policiais ?: '-') . "\n";
    $mensagem .= "𝗝𝗨𝗥𝗜́𝗗𝗜𝗖𝗢 𝗘𝗡𝗩𝗢𝗟𝗩𝗜𝗗𝗢: " . ($juridico ?: 'não veio') . "\n\n";
    $mensagem .= "𝗥𝗘𝗟𝗔𝗧𝗢́𝗥𝗜𝗢 𝗗𝗔 𝗔𝗖̧𝗔̃𝗢:\n" . ($relatorio ?: '-') . "\n\n";
    $mensagem .= "**ID:** $id | " . date('d/m/Y H:i:s');

    $boundary = '----WebKitFormBoundary' . bin2hex(random_bytes(16));
    $eol = "\r\n";
    
    $postData = '';
    
    $postData .= '--' . $boundary . $eol;
    $postData .= 'Content-Disposition: form-data; name="content"' . $eol . $eol;
    $postData .= $mensagem . $eol;
    
    $fileIndex = 0;
    foreach ($fotosCompletas as $filepath) {
        if (file_exists($filepath)) {
            $filename = basename($filepath);
            $fileContent = file_get_contents($filepath);
            $mimeType = mime_content_type($filepath);
            
            $postData .= '--' . $boundary . $eol;
            $postData .= 'Content-Disposition: form-data; name="file' . $fileIndex . '"; filename="' . $filename . '"' . $eol;
            $postData .= 'Content-Type: ' . $mimeType . $eol . $eol;
            $postData .= $fileContent . $eol;
            
            $fileIndex++;
        }
    }
    
    $postData .= '--' . $boundary . '--' . $eol;
    
    $ch = curl_init($webhookUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postData,
        CURLOPT_HTTPHEADER => [
            'Content-Type: multipart/form-data; boundary=' . $boundary,
            'Content-Length: ' . strlen($postData)
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    echo json_encode([
        'success' => true,
        'id' => $id,
        'message' => 'Prisão registrada e enviada para Discord com ' . count($fotosCompletas) . ' imagens!',
        'total_imagens' => count($fotosCompletas)
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>