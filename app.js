// Aguardar DOM carregar completamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}

function inicializar() {
  // Tema claro/escuro
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;

  if (!themeToggle) {
    console.error('Elemento themeToggle não encontrado');
    return;
  }

  const savedTheme = localStorage.getItem('brp-theme') || 'light';
  if (savedTheme === 'dark') {
    htmlEl.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('brp-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });

  // CONSTANTE: Redução máxima de 50%
  const MAX_REDUCAO = 50;

  const articlesList = document.getElementById('articles');
  
  if (!articlesList) {
    console.error('Elemento articles não encontrado');
    return;
  }

  let selected = new Map();
  let attenuantesSelected = new Set();

  function renderArticles(articles) {
    articlesList.innerHTML = '';
    articles.forEach(article => {
      const div = document.createElement('div');
      div.className = 'brp-article';
      div.textContent = article.text;
      
      if (selected.has(article.n)) {
        div.classList.add('selected');
      }
      
      div.onclick = () => {
        if (selected.has(article.n)) {
          selected.delete(article.n);
        } else {
          selected.set(article.n, article);
        }
        renderArticles(articlesData);
        updateFicha();
      };
      articlesList.appendChild(div);
    });
  }

  renderArticles(articlesData);

  document.getElementById('search').addEventListener('input', (e) => {
    const filtered = articlesData.filter(a =>
      a.text.toLowerCase().includes(e.target.value.toLowerCase())
    );
    renderArticles(filtered);
  });

  document.getElementById('btnclear').addEventListener('click', () => {
    document.getElementById('search').value = '';
    renderArticles(articlesData);
  });

  // Atenuantes com lógica de restrição
  document.querySelectorAll('.brp-att-item').forEach(el => {
    el.addEventListener('click', function() {
      const id = this.dataset.id;
      const requires = this.dataset.requires;

      if (attenuantesSelected.has(id)) {
        attenuantesSelected.delete(id);
        this.classList.remove('active');
        
        // Se desmarcar "Jurídico Constituído", remover dependentes
        if (id === 'Jurídico Constituído') {
          removerAtenuantesDependentes();
        }
      } else {
        if (requires && !attenuantesSelected.has(requires)) {
          alert(`⚠️ Este atenuante requer: ${requires}`);
          return;
        }
        attenuantesSelected.add(id);
        this.classList.add('active');
      }

      updateFicha();
    });
  });

  // Função para remover atenuantes que dependem de "Jurídico Constituído"
  function removerAtenuantesDependentes() {
    const dependentes = ['Réu Primário', 'Réu Confesso'];
    
    dependentes.forEach(dep => {
      if (attenuantesSelected.has(dep)) {
        attenuantesSelected.delete(dep);
        const depEl = document.querySelector(`[data-id="${dep}"]`);
        if (depEl) {
          depEl.classList.remove('active');
        }
      }
    });
  }

  function updateFicha() {
    document.getElementById('f-nome').textContent = document.getElementById('nome').value || '—';
    document.getElementById('f-id').textContent = document.getElementById('idacus').value || '—';

    const f_crimes = document.getElementById('f-crimes');
    f_crimes.innerHTML = '';
    
    // Verificar se há crime inafiançável
    let temInafiancavel = false;
    
    selected.forEach(article => {
      const li = document.createElement('li');
      li.textContent = article.text;
      f_crimes.appendChild(li);
      
      if (article.inafiancavel) {
        temInafiancavel = true;
      }
    });

    let penaTotal = 0;
    let multaTotal = 0;
    let fiancaTotal = 0;
    
    selected.forEach(article => {
      penaTotal += article.pena || 0;
      multaTotal += article.multa || 0;
      fiancaTotal += article.fianca || 0;
    });

    // Calcular redução total dos atenuantes
    let reducaoTotal = 0;
    attenuantesSelected.forEach(att => {
      const attEl = document.querySelector(`[data-id="${att}"]`);
      if (attEl) {
        const reduc = parseInt(attEl.dataset.reduc) || 0;
        reducaoTotal += reduc;
      }
    });

    // LIMITAR REDUÇÃO A MÁXIMO DE 50%
    if (reducaoTotal > MAX_REDUCAO) {
      reducaoTotal = MAX_REDUCAO;
    }

    const penaReduzida = Math.round(penaTotal * (1 - reducaoTotal / 100));
    const multaReduzida = Math.round(multaTotal * (1 - reducaoTotal / 100));

    document.getElementById('f-total').textContent = penaTotal;
    document.getElementById('f-reduc').textContent = `${reducaoTotal}%`;
    document.getElementById('f-total-red').textContent = penaReduzida;
    document.getElementById('totalpena').textContent = penaReduzida;
    document.getElementById('reduc').textContent = `${reducaoTotal}%`;

    // Atualizar cards (sempre mostra o valor normal)
    document.getElementById('valorMulta').textContent = multaReduzida.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const fiancaSelecionada = document.getElementById('fiancaSim').checked;
    
    // Card da fiança sempre mostra valor normal
    const fiancaValor = fiancaSelecionada ? fiancaTotal : 0;
    document.getElementById('valorFianca').textContent = fiancaValor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    // Se houver crime inafiançável, exibir mensagem APENAS NA FICHA
    if (temInafiancavel) {
      document.getElementById('f-fianca-container').textContent = 'Devido a crimes inafiançáveis, o réu perde o direito à fiança e cumprirá toda a pena na prisão.';
      document.getElementById('f-fianca-paid').textContent = 'Não (Crime Inafiançável)';
      
      // Desabilitar opção de fiança
      document.getElementById('fiancaSim').disabled = true;
      document.getElementById('fiancaNao').checked = true;
    } else {
      const valorFormatado = fiancaValor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      document.getElementById('f-fianca-container').innerHTML = `R$ <span id="f-fianca">${valorFormatado}</span>`;
      document.getElementById('f-fianca-paid').textContent = fiancaSelecionada ? 'Sim' : 'Não';
      
      // Reabilitar opção de fiança
      document.getElementById('fiancaSim').disabled = false;
    }

    const atten = Array.from(attenuantesSelected).join(', ') || 'Nenhum';
    document.getElementById('f-atten').textContent = atten;

    document.getElementById('f-multa').textContent = multaReduzida.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  updateFicha();

  // Atualizar ficha ao editar nome e ID
  document.getElementById('nome').addEventListener('input', updateFicha);
  document.getElementById('idacus').addEventListener('input', updateFicha);
  document.getElementById('fiancaSim').addEventListener('change', updateFicha);
  document.getElementById('fiancaNao').addEventListener('change', updateFicha);

  // BOTÃO CALCULAR PENA
  document.getElementById('calc').addEventListener('click', () => {
    if (selected.size === 0) {
      alert('Selecione pelo menos um artigo!');
      return;
    }
    updateFicha();
    alert('✅ Pena calculada com sucesso!');
  });

  // BOTÃO REGISTRAR PRISÃO
  document.getElementById('registrar').addEventListener('click', () => {
    if (selected.size === 0) {
      alert('⚠️ Selecione pelo menos um artigo!');
      return;
    }
    
    const nome = document.getElementById('nome').value;
    const passaporte = document.getElementById('idacus').value;
    
    if (!nome || !passaporte) {
      alert('⚠️ Preencha o nome e passaporte do acusado!');
      return;
    }
    
    document.getElementById('registroModal').style.display = 'flex';
  });

  // Fechar modais ao clicar fora
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('brp-modal')) {
      e.target.style.display = 'none';
    }
  });

  // ENVIAR REGISTRO PARA O SERVIDOR
  const enviarRegistroBtn = document.getElementById('enviarRegistro');
  if (enviarRegistroBtn) {
    enviarRegistroBtn.addEventListener('click', async () => {
      try {
        // Validar campos obrigatórios
        const prisaoPorId = document.getElementById('prisao_por_id').value;
        const prisaoPorNome = document.getElementById('prisao_por_nome').value;
        const relatorio = document.getElementById('relatorio_acao').value;

        if (!prisaoPorId || !prisaoPorNome || !relatorio) {
          alert('⚠️ Preencha os campos obrigatórios: ID de quem prendeu, Nome e Relatório!');
          return;
        }

        // Coletar dados da ficha
        const nome = document.getElementById('nome').value;
        const passaporte = document.getElementById('idacus').value;
        const reducao = document.getElementById('f-reduc').textContent;
        const penaReduzida = document.getElementById('f-total-red').textContent;
        const multa = document.getElementById('f-multa').textContent;
        
        // CORREÇÃO: Pegar apenas "Sim" ou "Não" do texto completo
        const fiancaPagaTexto = document.getElementById('f-fianca-paid').textContent;
        const fiancaPaga = fiancaPagaTexto.includes('Sim') ? 'Sim' : 'Não';
        
        // CORREÇÃO: Pegar apenas o valor da fiança sem o "R$"
        const fiancaCompleta = document.getElementById('f-fianca').textContent;

        const crimesLista = Array.from(selected.values())
          .map(a => `• ${a.text}`)
          .join('\n');

        const artigosNumeros = Array.from(selected.values())
          .map(a => a.n)
          .join(', ');

        const atenuantesLista = Array.from(attenuantesSelected).length > 0
          ? Array.from(attenuantesSelected).join(', ')
          : 'Nenhum';

        // FORMATAR PRISÃO POR (Nome | ID)
        const prisaoPorFormatado = `${prisaoPorNome} | ${prisaoPorId}`;

        // FORMATAR POLICIAIS ENVOLVIDOS (Nome | ID, Nome | ID)
        const policiaisIds = document.getElementById('policiais_ids').value || '';
        const policiaisNomes = document.getElementById('policiais_nomes').value || '';
        
        let policiaisFormatado = '';
        if (policiaisIds && policiaisNomes) {
          const ids = policiaisIds.split(',').map(p => p.trim()).filter(Boolean);
          const nomes = policiaisNomes.split(',').map(p => p.trim()).filter(Boolean);
          
          const policiaisArray = [];
          for (let i = 0; i < Math.min(ids.length, nomes.length); i++) {
            policiaisArray.push(`${nomes[i]} | ${ids[i]}`);
          }
          policiaisFormatado = policiaisArray.join(', ');
        }

        // Criar FormData
        const formData = new FormData();
        
        // Dados da ficha
        formData.append('nome', nome);
        formData.append('passaporte', passaporte);
        formData.append('crimes', crimesLista);
        formData.append('artigos', artigosNumeros);
        formData.append('reducao', reducao);
        formData.append('atenuantes', atenuantesLista);
        formData.append('pena', penaReduzida + ' meses');
        formData.append('multa', 'R$ ' + multa);
        formData.append('fianca_paga', fiancaPaga); // CORRIGIDO: apenas "Sim" ou "Não"
        formData.append('fianca', 'R$ ' + fiancaCompleta); // CORRIGIDO: com R$
        
        // Dados do registro (COM FORMATAÇÃO)
        formData.append('prisao_por_id', prisaoPorId);
        formData.append('prisao_por', prisaoPorFormatado);
        formData.append('policiais_ids', policiaisIds);
        formData.append('policiais', policiaisFormatado);
        formData.append('juridico', document.getElementById('juridico_nome').value || '');
        formData.append('relatorio', relatorio);

        // Anexar imagens com os nomes corretos
        const fotoInv = document.getElementById('foto_inventario')?.files[0];
        const fotoMdt = document.getElementById('foto_mdt')?.files[0];
        const fotoOab = document.getElementById('foto_oab')?.files[0];
        const fotoRgMask = document.getElementById('foto_rg_mask')?.files[0];
        const fotoRg = document.getElementById('foto_rg')?.files[0];

        if (fotoInv) formData.append('foto_inventario', fotoInv);
        if (fotoMdt) formData.append('foto_mdt', fotoMdt);
        if (fotoOab) formData.append('foto_oab', fotoOab);
        if (fotoRgMask) formData.append('foto_rg_mask', fotoRgMask);
        if (fotoRg) formData.append('foto_rg', fotoRg);

        // Enviar para o servidor
        const response = await fetch('api/registrar.php', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          alert('✅ Prisão registrada com sucesso!\n📊 ID da Ficha: ' + data.id);
          document.getElementById('registroModal').style.display = 'none';
          
          // Limpar campos
          document.getElementById('prisao_por_id').value = '';
          document.getElementById('prisao_por_nome').value = '';
          document.getElementById('policiais_ids').value = '';
          document.getElementById('policiais_nomes').value = '';
          document.getElementById('juridico_nome').value = '';
          document.getElementById('relatorio_acao').value = '';
          
          // Limpar previews de imagem
          document.querySelectorAll('.brp-paste-preview').forEach(preview => {
            preview.innerHTML = '<span>Clique para selecionar ou cole a imagem aqui (Ctrl+V)</span>';
            preview.classList.remove('has-image');
          });
          
          // Limpar inputs de arquivo
          const inputs = ['foto_inventario', 'foto_mdt', 'foto_oab', 'foto_rg_mask', 'foto_rg'];
          inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
          });
        } else {
          alert('❌ Erro ao registrar prisão: ' + data.error);
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao enviar dados: ' + error.message);
      }
    });
  }

  // BOTÃO LIMPAR
  document.getElementById('limpar').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar tudo?')) {
      selected.clear();
      attenuantesSelected.clear();
      document.getElementById('nome').value = '';
      document.getElementById('idacus').value = '';
      document.getElementById('fiancaNao').checked = true;
      document.getElementById('search').value = '';
      document.querySelectorAll('.brp-att-item').forEach(el => {
        el.classList.remove('active');
      });
      renderArticles(articlesData);
      updateFicha();
    }
  });

  // ========== SISTEMA DE PASTE/DRAG DE IMAGENS ==========
  document.addEventListener('DOMContentLoaded', () => {
    const pasteAreas = document.querySelectorAll('.brp-paste-area');
    let areaAtiva = null;

    pasteAreas.forEach(area => {
      const targetId = area.dataset.target;
      const inputFile = document.getElementById(targetId);
      const previewDiv = area.querySelector('.brp-paste-preview');

      // Criar botão de upload
      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'brp-upload-btn';
      uploadBtn.innerHTML = '📁';
      uploadBtn.title = 'Selecionar arquivo';
      uploadBtn.type = 'button';
      area.appendChild(uploadBtn);

      // Botão de upload abre seletor
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        inputFile.click();
      });

      // Clique na área apenas SELECIONA (não abre arquivo)
      area.addEventListener('click', (e) => {
        if (e.target.classList.contains('brp-remove-img') || 
            e.target.classList.contains('brp-upload-btn')) {
          return;
        }

        // Remove foco de todas as áreas
        pasteAreas.forEach(a => a.classList.remove('area-ativa'));
        
        // Adiciona foco na área clicada
        area.classList.add('area-ativa');
        areaAtiva = area;
      });

      // Mudança no input de arquivo
      inputFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          displayImage(file, previewDiv, inputFile);
        }
      });

      // Paste (Ctrl+V)
      area.addEventListener('paste', (e) => {
        e.preventDefault();
        const items = e.clipboardData?.items;
        
        if (items) {
          for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
              const file = item.getAsFile();
              if (file) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                inputFile.files = dataTransfer.files;
                
                displayImage(file, previewDiv, inputFile);
              }
            }
          }
        }
      });

      // Drag and Drop
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragging');
      });

      area.addEventListener('dragleave', () => {
        area.classList.remove('dragging');
      });

      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragging');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputFile.files = dataTransfer.files;
          
          displayImage(file, previewDiv, inputFile);
        }
      });
    });

    // Função para exibir imagem
    function displayImage(file, previewDiv, inputFile) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        previewDiv.innerHTML = `
          <img src="${e.target.result}" alt="Preview" />
          <button class="brp-remove-img" title="Remover imagem">×</button>
        `;
        previewDiv.classList.add('has-image');

        // Botão remover
        const removeBtn = previewDiv.querySelector('.brp-remove-img');
        removeBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          inputFile.value = '';
          previewDiv.innerHTML = '<span>Clique para selecionar ou cole a imagem aqui (Ctrl+V)</span>';
          previewDiv.classList.remove('has-image');
        });
      };

      reader.readAsDataURL(file);
    }

    // Paste GLOBAL no modal
    document.getElementById('registroModal').addEventListener('paste', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if (areaAtiva) {
        const items = e.clipboardData?.items;
        
        if (items) {
          for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
              e.preventDefault();
              const file = item.getAsFile();
              
              if (file) {
                const targetId = areaAtiva.dataset.target;
                const inputFile = document.getElementById(targetId);
                const previewDiv = areaAtiva.querySelector('.brp-paste-preview');

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                inputFile.files = dataTransfer.files;

                displayImage(file, previewDiv, inputFile);
                
                const nomeArea = targetId.replace('foto_', '').replace('_', ' ').toUpperCase();
                alert(`✅ Imagem colada em: ${nomeArea}`);
                break;
              }
            }
          }
        }
      } else {
        const items = e.clipboardData?.items;
        if (items) {
          for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
              e.preventDefault();
              alert('⚠️ Clique primeiro na área onde deseja colar a imagem!');
              break;
            }
          }
        }
      }
    });
  });

  // ========== BOTÕES DE BUSCA ==========

  // BUSCAR ANTECEDENTES
  document.getElementById('buscarAntecedentes').addEventListener('click', () => {
    document.getElementById('antecedentesModal').style.display = 'flex';
    document.getElementById('resultadoAntecedentes').innerHTML = '';
    document.getElementById('busca_antecedentes_id').value = '';
  });

  document.getElementById('closeAntecedentes').addEventListener('click', () => {
    document.getElementById('antecedentesModal').style.display = 'none';
  });

  document.getElementById('btnBuscarAntecedentes').addEventListener('click', async () => {
    const id = document.getElementById('busca_antecedentes_id').value.trim();
    
    if (!id) {
      alert('⚠️ Digite o ID do acusado!');
      return;
    }

    const resultado = document.getElementById('resultadoAntecedentes');
    resultado.innerHTML = '<div style="text-align: center; color: var(--brp-accent);">🔍 Buscando...</div>';

    try {
      const response = await fetch(`api/buscar.php?tipo=antecedentes&id=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (data.success) {
        const ant = data.antecedentes;
        const fichas = data.fichas || [];

        let html = `
          <h3>📋 ANTECEDENTES CRIMINAIS</h3>
          <div class="info-line"><strong>Nome:</strong> ${ant.nome}</div>
          <div class="info-line"><strong>ID/Passaporte:</strong> ${ant.id}</div>
          <div class="info-line"><strong>Total de Prisões:</strong> ${ant.total_prisoes}</div>
          <div class="info-line"><strong>Artigos Acumulados:</strong> ${ant.artigos || 'Nenhum'}</div>
          <div class="info-line"><strong>Última Prisão:</strong> ${ant.ultima ? new Date(ant.ultima).toLocaleString('pt-BR') : '-'}</div>
          
          <h3 style="margin-top: 20px;">📑 HISTÓRICO DE FICHAS (${fichas.length})</h3>
        `;

        if (fichas.length > 0) {
          fichas.forEach(ficha => {
            html += `
              <div class="ficha-item">
                <strong>ID da Ficha:</strong> ${ficha.id}<br>
                <strong>Data:</strong> ${new Date(ficha.data).toLocaleString('pt-BR')}<br>
                <strong>Artigos:</strong> ${ficha.artigos}<br>
                <strong>Pena:</strong> ${ficha.pena}<br>
                <strong>Multa:</strong> ${ficha.multa}<br>
                <strong>Preso por:</strong> ${ficha.prisao_por}
              </div>
            `;
          });
        } else {
          html += '<div class="sem-dados">Nenhuma ficha encontrada</div>';
        }

        resultado.innerHTML = html;
      } else {
        resultado.innerHTML = `<div class="sem-dados">❌ ${data.error || 'Nenhum antecedente encontrado'}</div>`;
      }
    } catch (error) {
      resultado.innerHTML = `<div class="sem-dados">❌ Erro: ${error.message}</div>`;
    }
  });

  // BUSCAR FICHA
  document.getElementById('buscarFicha').addEventListener('click', () => {
    document.getElementById('fichaModal').style.display = 'flex';
    document.getElementById('resultadoFicha').innerHTML = '';
    document.getElementById('busca_ficha_id').value = '';
  });

  document.getElementById('closeFicha').addEventListener('click', () => {
    document.getElementById('fichaModal').style.display = 'none';
  });

  document.getElementById('btnBuscarFicha').addEventListener('click', async () => {
    const id = document.getElementById('busca_ficha_id').value.trim();
    
    if (!id) {
      alert('⚠️ Digite o ID da ficha!');
      return;
    }

    const resultado = document.getElementById('resultadoFicha');
    resultado.innerHTML = '<div style="text-align: center; color: var(--brp-accent);">🔍 Buscando...</div>';

    try {
      const response = await fetch(`api/buscar.php?tipo=ficha&id=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (data.success) {
        const f = data.ficha;

        let html = `
          <h3>📋 FICHA CRIMINAL #${f.id}</h3>
          <div class="info-line"><strong>Nome:</strong> ${f.nome}</div>
          <div class="info-line"><strong>Passaporte:</strong> ${f.passaporte}</div>
          <div class="info-line"><strong>Data:</strong> ${new Date(f.data).toLocaleString('pt-BR')}</div>
          <div class="info-line"><strong>Artigos:</strong> ${f.artigos}</div>
          <div class="info-line"><strong>Crimes:</strong><br>${f.crimes.replace(/\n/g, '<br>')}</div>
          <div class="info-line"><strong>Redução:</strong> ${f.reducao}</div>
          <div class="info-line"><strong>Atenuantes:</strong> ${f.atenuantes}</div>
          <div class="info-line"><strong>Pena:</strong> ${f.pena}</div>
          <div class="info-line"><strong>Multa:</strong> ${f.multa}</div>
          <div class="info-line"><strong>Fiança Paga:</strong> ${f.fianca_paga}</div>
          <div class="info-line"><strong>Valor Fiança:</strong> ${f.fianca}</div>
          <div class="info-line"><strong>Prisão Feita Por:</strong> ${f.prisao_por}</div>
          <div class="info-line"><strong>Policiais Envolvidos:</strong> ${f.policiais || '-'}</div>
          <div class="info-line"><strong>Jurídico:</strong> ${f.juridico || '-'}</div>
          <div class="info-line"><strong>Relatório:</strong><br>${f.relatorio || '-'}</div>
        `;

        // Mostrar imagens se houver
        if (f.foto_inv || f.foto_mdt || f.foto_oab || f.foto_rg_mask || f.foto_rg) {
          html += '<h3 style="margin-top: 20px;">📸 IMAGENS ANEXADAS</h3>';
          
          if (f.foto_inv) html += `<div class="info-line"><strong>Inventário:</strong> <a href="${f.foto_inv}" target="_blank">Ver imagem</a></div>`;
          if (f.foto_mdt) html += `<div class="info-line"><strong>MDT:</strong> <a href="${f.foto_mdt}" target="_blank">Ver imagem</a></div>`;
          if (f.foto_oab) html += `<div class="info-line"><strong>OAB:</strong> <a href="${f.foto_oab}" target="_blank">Ver imagem</a></div>`;
          if (f.foto_rg_mask) html += `<div class="info-line"><strong>RG com Máscara:</strong> <a href="${f.foto_rg_mask}" target="_blank">Ver imagem</a></div>`;
          if (f.foto_rg) html += `<div class="info-line"><strong>RG sem Máscara:</strong> <a href="${f.foto_rg}" target="_blank">Ver imagem</a></div>`;
        }

        resultado.innerHTML = html;
      } else {
        resultado.innerHTML = `<div class="sem-dados">❌ ${data.error || 'Ficha não encontrada'}</div>`;
      }
    } catch (error) {
      resultado.innerHTML = `<div class="sem-dados">❌ Erro: ${error.message}</div>`;
    }
  });

  // BUSCAR POLICIAL
  document.getElementById('buscarPolicial').addEventListener('click', () => {
    document.getElementById('policialModal').style.display = 'flex';
    document.getElementById('resultadoPolicial').innerHTML = '';
    document.getElementById('busca_policial_id').value = '';
  });

  document.getElementById('closePolicial').addEventListener('click', () => {
    document.getElementById('policialModal').style.display = 'none';
  });

  document.getElementById('btnBuscarPolicial').addEventListener('click', async () => {
    const id = document.getElementById('busca_policial_id').value.trim();
    
    if (!id) {
      alert('⚠️ Digite o ID do policial!');
      return;
    }

    const resultado = document.getElementById('resultadoPolicial');
    resultado.innerHTML = '<div style="text-align: center; color: var(--brp-accent);">🔍 Buscando...</div>';

    try {
      const response = await fetch(`api/buscar.php?tipo=policial&id=${encodeURIComponent(id)}`);
      const data = await response.json();

      if (data.success) {
        const pol = data.policial;

        let html = `
          <h3>👮 ESTATÍSTICAS DO POLICIAL</h3>
          <div class="info-line"><strong>Nome:</strong> ${pol.nome}</div>
          <div class="info-line"><strong>ID:</strong> ${pol.id}</div>
          <div class="info-line"><strong>Total de Prisões Envolvidas:</strong> ${pol.total_prisoes}</div>
          <div class="info-line"><strong>Última Prisão:</strong> ${pol.ultima ? new Date(pol.ultima).toLocaleString('pt-BR') : '-'}</div>
        `;

        resultado.innerHTML = html;
      } else {
        resultado.innerHTML = `<div class="sem-dados">❌ ${data.error || 'Policial não encontrado'}</div>`;
      }
    } catch (error) {
      resultado.innerHTML = `<div class="sem-dados">❌ Erro: ${error.message}</div>`;
    }
  });
}