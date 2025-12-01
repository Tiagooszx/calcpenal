<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    // CONEXÃO RAILWAY
    $db = new PDO(
        'mysql:host=yamabiko.proxy.rlwy.net;port=22038;dbname=railway;charset=utf8mb4',
        'root',
        'RjCcrYAtYaUDvDJuqbFbNHWMpFDAXewM'
    );
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tipo = $_GET['tipo'] ?? '';
    $id = $_GET['id'] ?? '';

    if (!$tipo || !$id) {
        throw new Exception('Parâmetros inválidos');
    }

    switch ($tipo) {
        case 'antecedentes':
            // BUSCA EXATA por ID
            $stmt = $db->prepare('SELECT * FROM antecedentes WHERE id = ?');
            $stmt->execute([$id]);
            $antecedentes = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$antecedentes) {
                echo json_encode(['success' => false, 'error' => 'Nenhum antecedente encontrado']);
                exit;
            }

            // Buscar todas as fichas do preso
            $stmtFichas = $db->prepare('SELECT * FROM fichas WHERE passaporte = ? ORDER BY data DESC');
            $stmtFichas->execute([$id]);
            $fichas = $stmtFichas->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'antecedentes' => $antecedentes,
                'fichas' => $fichas
            ]);
            break;

        case 'ficha':
            // BUSCA EXATA por ID da ficha
            $stmt = $db->prepare('SELECT * FROM fichas WHERE id = ?');
            $stmt->execute([$id]);
            $ficha = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ficha) {
                echo json_encode(['success' => false, 'error' => 'Ficha não encontrada']);
                exit;
            }

            echo json_encode([
                'success' => true,
                'ficha' => $ficha
            ]);
            break;

        case 'policial':
            // BUSCA EXATA por ID do policial
            $stmt = $db->prepare('SELECT * FROM policiais WHERE id = ?');
            $stmt->execute([$id]);
            $policial = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$policial) {
                echo json_encode(['success' => false, 'error' => 'Policial não encontrado']);
                exit;
            }

            echo json_encode([
                'success' => true,
                'policial' => $policial
            ]);
            break;

        default:
            throw new Exception('Tipo de busca inválido');
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>