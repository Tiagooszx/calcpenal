// Tema claro/escuro
const themeToggle = document.getElementById('themeToggle');
const htmlEl = document.documentElement;

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

// Lista de artigos inafiançáveis
const CRIMES_INAFIANCAVEIS = [
  'Art. 01', 'Art. 02', 'Art. 03', 'Art. 05', 'Art. 06', 'Art. 08', 'Art. 09', 
  'Art. 10', 'Art. 11', 'Art. 12', 'Art. 13', 'Art. 20', 'Art. 27', 
  'Art. 28', 'Art. 40', 'Art. 42'
];

// CONSTANTE: Redução máxima de 50%
const MAX_REDUCAO = 50;

let selected = new Map();
let attenuantesSelected = new Set();

const articlesEl = document.getElementById('articles');

function renderArticles(list) {
  articlesEl.innerHTML = '';
  list.forEach(a => {
    const el = document.createElement('div');
    el.className = 'brp-article';
    el.textContent = a.text;
    el.addEventListener('click', () => toggleSelect(a));
    if (selected.has(a.n)) {
      el.classList.add('selected');
    }
    articlesEl.appendChild(el);
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

function verificarCrimesInafiancaveis() {
  const temInafiancavel = Array.from(selected.keys()).some(n => {
    const article = articlesData.find(a => a.n === n);
    return article && CRIMES_INAFIANCAVEIS.some(crime => article.text.includes(crime));
  });

  const fiancaSim = document.getElementById('fiancaSim');
  const fiancaNao = document.getElementById('fiancaNao');
  const aviso = document.getElementById('avisoInafiancavel');

  if (temInafiancavel) {
    fiancaSim.disabled = true;
    fiancaNao.checked = true;
    aviso.style.display = 'block';
  } else {
    fiancaSim.disabled = false;
    aviso.style.display = 'none';
  }
}

function removerAtenuantesDependentes(idRemovido) {
  // Se removeu "juridico", remove todos que dependem dele
  if (idRemovido === 'juridico') {
    const dependentes = ['primario', 'confesso'];
    dependentes.forEach(dep => {
      if (attenuantesSelected.has(dep)) {
        attenuantesSelected.delete(dep);
        const el = document.querySelector(`[data-id="${dep}"]`);
        if (el) {
          el.classList.remove('active');
        }
      }
    });
  }
}

function toggleSelect(a) {
  if (selected.has(a.n)) {
    selected.delete(a.n);
  } else {
    selected.set(a.n, a);
  }
  verificarCrimesInafiancaveis();
  renderArticles(
    articlesData.filter(item =>
      item.text.toLowerCase().includes(
        document.getElementById('search').value.toLowerCase()
      )
    )
  );
  updateFicha();
}

// Atenuantes com lógica de restrição
document.querySelectorAll('.brp-att-item').forEach(el => {
  el.addEventListener('click', function() {
    const id = this.dataset.id;
    const requires = this.dataset.requires;

    if (attenuantesSelected.has(id)) {
      // DESATIVANDO - remover e também remover dependentes
      attenuantesSelected.delete(id);
      this.classList.remove('active');
      removerAtenuantesDependentes(id);
    } else {
      // ATIVANDO - verificar se tem dependência
      if (requires && !attenuantesSelected.has(requires)) {
        alert(`Este atenuante requer: ${requires}`);
        return;
      }
      attenuantesSelected.add(id);
      this.classList.add('active');
    }

    updateFicha();
  });
});


function updateFicha() {
  document.getElementById('f-nome').textContent = document.getElementById('nome').value || '—';
  document.getElementById('f-id').textContent = document.getElementById('idacus').value || '—';

  const f_crimes = document.getElementById('f-crimes');
  f_crimes.innerHTML = '';
  selected.forEach(article => {
    const li = document.createElement('li');
    li.textContent = article.text;
    f_crimes.appendChild(li);
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

  // Atualizar cards
  document.getElementById('valorMulta').textContent = multaReduzida.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const fiancaSelecionada = document.getElementById('fiancaSim').checked;
  const fianca = fiancaSelecionada ? fiancaTotal : 0;
  
  document.getElementById('valorFianca').textContent = fianca.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  document.getElementById('f-fianca').textContent = fianca.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  document.getElementById('f-fianca-paid').textContent = fiancaSelecionada ? 'Sim' : 'Não';

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

document.getElementById('copiarComChecklist').addEventListener('click', () => {
  const checks = [...document.querySelectorAll('.brp-checklist-item input')];
  const naoMarcados = checks.filter(c => !c.checked);

  if (naoMarcados.length > 0) {
    alert('⚠️ Você precisa marcar todos os itens do checklist!');
    return;
  }

  // aqui chama o mesmo código que gera o texto final da pena
});


// BOTÃO COPIAR PENA
document.getElementById('copy').addEventListener('click', () => {
  if (selected.size === 0) {
    alert('Selecione pelo menos um artigo!');
    return;
  }

  const nome = document.getElementById('nome').value;
  const id = document.getElementById('idacus').value;
  const penaTotal = document.getElementById('f-total').textContent;
  const reducao = document.getElementById('f-reduc').textContent;
  const penaReduzida = document.getElementById('f-total-red').textContent;
  const multa = document.getElementById('f-multa').textContent;
  const fianca = document.getElementById('f-fianca').textContent;

  const texto = `
━━━ CÁLCULO PENAL ━━━
👤 ACUSADO: ${nome}
🆔 ID/PASSAPORTE: ${id}

📋 CRIMES:
${Array.from(selected.values())
  .map(a => `  • ${a.text}`)
  .join('\n')}

⚖️ ATENUANTES:
${Array.from(attenuantesSelected).length > 0
  ? Array.from(attenuantesSelected)
      .map(att => {
        const el = document.querySelector(`[data-id="${att}"]`);
        return el ? `  • ${el.textContent}` : '';
      })
      .join('\n')
  : '  Nenhum'}

📊 CÁLCULO:
  • Pena Total: ${penaTotal} meses
  • Redução: ${reducao}
  • Pena Reduzida: ${penaReduzida} meses
  • Multa: R$ ${multa}
  • Fiança: R$ ${fianca}

━━━━━━━━━━━━━━━━━━━━━
`;
   
  document.getElementById('checklistModal').style.display = 'block';
  document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('checklistModal').style.display = 'none';
});
});

// BOTÃO CÓDIGO PENAL
document.getElementById('codigo').addEventListener('click', () => {
  alert('📖 Redirecionando para o Código Penal...');
});

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