document.addEventListener('DOMContentLoaded', async function () {

    const apiUrl = 'https://autopecascanada.onrender.com/pecas';
    const tableBody = document.querySelector('.inventory-table tbody');

    let listaDePecas = [];
    let idDaPecaAberta = null;

    // Elementos UI
    const modal = document.getElementById('detalhesModal');
    const addModal = document.getElementById('addModal');
    const sidePanel = document.getElementById('sidePanel');
    const addSidePanel = document.getElementById('addSidePanel');

    // ==========================================
    // SISTEMA DE TOASTS (NOTIFICAÇÕES)
    // ==========================================
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function formatarMoeda(valor) {
        const numero = parseFloat(String(valor).replace(',', '.'));
        if (isNaN(numero)) return valor;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
    }

    function renderizarTabela(pecas) {
        listaDePecas = pecas;
        tableBody.innerHTML = '';
        pecas.forEach(peca => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', peca._id);
            row.innerHTML = `
                <td>${peca.id || ''}</td>
                <td class="nome-clicavel" title="Clique para ver os detalhes">${peca.nome || ''}</td>
                <td>${peca.marca || ''}</td>
                <td>${peca.estoque || 0}</td>
                <td>${formatarMoeda(peca.preco || 0)}</td>
                <td>${peca.localizacao || ''}</td>
                <td class="actions">
                    <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
                </td>
            `;
        });
    }

    async function carregarPecas() {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Falha na rede');
            const pecas = await response.json();
            renderizarTabela(pecas);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Não foi possível conectar ao servidor.</td></tr>`;
            showToast("Erro de conexão com o banco de dados.", "error");
        }
    }

    // Busca
    document.querySelector('.search-bar input').addEventListener('keyup', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        tableBody.querySelectorAll('tr').forEach(row => {
            const nameCell = row.cells[1].innerText.toLowerCase();
            const codeCell = row.cells[0].innerText.toLowerCase();
            row.style.display = (nameCell.includes(searchTerm) || codeCell.includes(searchTerm)) ? '' : 'none';
        });
    });

    // ==========================================
    // PAINEL: ADICIONAR NOVA PEÇA
    // ==========================================
    document.querySelector('.btn-add').addEventListener('click', () => {
        ['addCodigo', 'addNome', 'addMarca', 'addPreco', 'addLocalizacao', 'addImagens'].forEach(id => {
            document.getElementById(id).value = '';
            document.getElementById(id).classList.remove('input-error');
        });
        document.getElementById('addEstoque').value = '1';
        document.getElementById('erroCodigo').style.display = 'none';

        addModal.style.display = 'block';
        setTimeout(() => addSidePanel.classList.add('open'), 10);
    });

    function fecharAddPainel() {
        addSidePanel.classList.remove('open');
        setTimeout(() => addModal.style.display = "none", 400);
    }

    document.getElementById('fecharAddPainelTop').onclick = fecharAddPainel;
    document.getElementById('btnCancelarNovaPeca').onclick = fecharAddPainel;

    document.getElementById('btnSalvarNovaPeca').onclick = async function () {
        const codigoInput = document.getElementById('addCodigo');
        const nomeInput = document.getElementById('addNome');
        const codigoValor = codigoInput.value.trim();
        const nomeValor = nomeInput.value.trim();
        const precoValor = document.getElementById('addPreco').value.replace(',', '.').trim();

        codigoInput.classList.remove('input-error');
        nomeInput.classList.remove('input-error');
        document.getElementById('erroCodigo').style.display = 'none';

        if (!codigoValor || !nomeValor) {
            if (!codigoValor) codigoInput.classList.add('input-error');
            if (!nomeValor) nomeInput.classList.add('input-error');
            showToast("Preencha os campos obrigatórios (*)", "warning");
            return;
        }

        if (listaDePecas.some(p => String(p.id) === String(codigoValor))) {
            codigoInput.classList.add('input-error');
            document.getElementById('erroCodigo').style.display = 'block';
            showToast("O código digitado já pertence a outro produto.", "error");
            return;
        }

        const formData = new FormData();
        formData.append('id', codigoValor);
        formData.append('nome', nomeValor);
        formData.append('marca', document.getElementById('addMarca').value);
        formData.append('estoque', document.getElementById('addEstoque').value);
        formData.append('preco', precoValor || 0);
        formData.append('localizacao', document.getElementById('addLocalizacao').value);

        const fileInput = document.getElementById('addImagens');
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('imagens', fileInput.files[i]);
        }

        const btn = document.getElementById('btnSalvarNovaPeca');
        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;

            const response = await fetch(apiUrl, { method: 'POST', body: formData });
            if (response.ok) {
                await carregarPecas();
                fecharAddPainel();
                showToast("Peça cadastrada com sucesso!", "success");
            } else {
                showToast("Erro ao processar as fotos ou salvar a peça.", "error");
            }
        } catch (error) {
            showToast("Servidor indisponível. Verifique o backend.", "error");
        } finally {
            btn.innerHTML = '<i class="fa fa-check"></i> Finalizar Cadastro';
            btn.disabled = false;
        }
    };

    // ==========================================
    // PAINEL: DETALHES, EDIÇÃO E EXCLUSÃO
    // ==========================================
    tableBody.addEventListener('click', async function (event) {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');

        if (target.classList.contains('nome-clicavel')) {
            const pecaClicada = listaDePecas.find(p => p._id === id);
            if (pecaClicada) {
                idDaPecaAberta = id;
                document.getElementById('modalNome').textContent = pecaClicada.nome;

                let fotosParaExibir = [];
                if (pecaClicada.imagemUrl && (!pecaClicada.imagensUrls || pecaClicada.imagensUrls.length === 0)) fotosParaExibir.push(pecaClicada.imagemUrl);
                if (pecaClicada.imagensUrls && pecaClicada.imagensUrls.length > 0) fotosParaExibir = pecaClicada.imagensUrls;

                const modalImagens = document.getElementById('modalImagens');
                modalImagens.innerHTML = '';
                if (fotosParaExibir.length > 0) {
                    fotosParaExibir.forEach(url => {
                        const imgElement = document.createElement('img');
                        imgElement.src = url;
                        modalImagens.appendChild(imgElement);
                    });
                } else {
                    modalImagens.innerHTML = '<p style="color: #888; font-size: 0.9rem;">Nenhuma foto cadastrada.</p>';
                }

                document.getElementById('modalInfo').innerHTML = `
                    <p><strong>Código:</strong> <span>${pecaClicada.id}</span></p>
                    <p><strong>Marca:</strong> <span>${pecaClicada.marca || 'N/A'}</span></p>
                    <p><strong>Estoque:</strong> <span>${pecaClicada.estoque} un.</span></p>
                    <p><strong>Preço:</strong> <span>${formatarMoeda(pecaClicada.preco)}</span></p>
                    <p><strong>Localização:</strong> <span>${pecaClicada.localizacao || 'N/A'}</span></p>
                `;

                modoVisualizacao();
                modal.style.display = 'block';
                setTimeout(() => sidePanel.classList.add('open'), 10);
            }
            return;
        }

        const button = target.closest('.btn-delete');
        if (button) {
            if (confirm('Tem certeza que deseja excluir esta peça?')) {
                try {
                    const response = await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        carregarPecas();
                        showToast("Peça excluída do estoque.", "warning");
                    }
                } catch (error) {
                    showToast("Erro ao deletar peça.", "error");
                }
            }
        }
    });

    function modoVisualizacao() {
        document.getElementById('painelVisualizacao').style.display = 'block';
        document.getElementById('painelEdicao').style.display = 'none';
        document.getElementById('btnHabilitarEdicao').style.display = 'block';
        document.getElementById('btnSalvarEdicao').style.display = 'none';
        document.getElementById('btnCancelarEdicao').style.display = 'none';
    }

    function modoEdicao() {
        document.getElementById('painelVisualizacao').style.display = 'none';
        document.getElementById('painelEdicao').style.display = 'block';
        document.getElementById('btnHabilitarEdicao').style.display = 'none';
        document.getElementById('btnSalvarEdicao').style.display = 'block';
        document.getElementById('btnCancelarEdicao').style.display = 'block';
    }

    document.getElementById('btnHabilitarEdicao').onclick = function () {
        const peca = listaDePecas.find(p => p._id === idDaPecaAberta);
        if (peca) {
            document.getElementById('editCodigo').value = peca.id || '';
            document.getElementById('editNome').value = peca.nome || '';
            document.getElementById('editMarca').value = peca.marca || '';
            document.getElementById('editEstoque').value = peca.estoque || 0;
            document.getElementById('editPreco').value = (peca.preco || 0).toString().replace('.', ',');
            document.getElementById('editLocalizacao').value = peca.localizacao || '';
            document.getElementById('editImagens').value = '';
            modoEdicao();
        }
    };

    document.getElementById('btnCancelarEdicao').onclick = modoVisualizacao;

    document.getElementById('btnSalvarEdicao').onclick = async function () {
        const formData = new FormData();
        formData.append('id', document.getElementById('editCodigo').value);
        formData.append('nome', document.getElementById('editNome').value);
        formData.append('marca', document.getElementById('editMarca').value);
        formData.append('estoque', document.getElementById('editEstoque').value);
        formData.append('preco', document.getElementById('editPreco').value.replace(',', '.'));
        formData.append('localizacao', document.getElementById('editLocalizacao').value);

        const fileInput = document.getElementById('editImagens');
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('imagens', fileInput.files[i]);
        }

        const btnSalvar = document.getElementById('btnSalvarEdicao');
        try {
            btnSalvar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;

            const response = await fetch(`${apiUrl}/${idDaPecaAberta}`, { method: 'PUT', body: formData });
            if (response.ok) {
                await carregarPecas();
                fecharPainel();
                showToast("Peça atualizada com sucesso!", "success");
            } else {
                showToast("Erro ao atualizar os dados.", "error");
            }
        } catch (error) {
            showToast("Erro de conexão.", "error");
        } finally {
            btnSalvar.innerHTML = '<i class="fa fa-check"></i> Salvar';
            btnSalvar.disabled = false;
        }
    };

    function fecharPainel() {
        sidePanel.classList.remove('open');
        setTimeout(() => {
            modal.style.display = "none";
            modoVisualizacao();
        }, 400);
    }

    document.getElementById('fecharPainelTop').onclick = fecharPainel;

    window.onclick = function (event) {
        if (event.target === modal) fecharPainel();
        if (event.target === addModal) fecharAddPainel();
    }

    carregarPecas();
});