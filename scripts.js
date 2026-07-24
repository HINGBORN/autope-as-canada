document.addEventListener('DOMContentLoaded', async function () {

    const apiUrl = 'https://autopecascanada.onrender.com/pecas';
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const filtroMarca = document.getElementById('filtroMarca');
    const filtroPreco = document.getElementById('filtroPreco');

    let listaDePecas = [];
    let idDaPecaAberta = null;
    let imagensAtuaisEdicao = [];
    let forcarMostrarTodos = false;

    const modal = document.getElementById('detalhesModal');
    const addModal = document.getElementById('addModal');

    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('tableWrapper');
    const dashboardMetrics = document.getElementById('dashboardMetrics');

    // ==========================================
    // SISTEMA DE NOTIFICAÇÕES (TOAST)
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

    // ==========================================
    // NOVO: COMPRESSOR DE IMAGENS ULTRARRÁPIDO
    // ==========================================
    async function comprimirImagem(file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function (event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function () {
                    let width = img.width;
                    let height = img.height;

                    // Calcula a nova dimensão mantendo a proporção
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Converte para um arquivo menor (Blob)
                    canvas.toBlob((blob) => {
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(newFile);
                    }, 'image/jpeg', quality);
                };
            };
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'F2') {
            event.preventDefault();
            abrirModalAdicionar();
        }
        if (event.key === 'Escape') {
            fecharPainel();
            fecharAddPainel();
        }
    });

    document.getElementById('btnVerTodos').addEventListener('click', () => {
        forcarMostrarTodos = true;
        searchInput.value = '';
        filtroMarca.value = '';
        filtroPreco.value = '';
        aplicarFiltros();
    });

    function abrirModalAdicionar() {
        ['addCodigo', 'addNome', 'addMarca', 'addPreco', 'addLocalizacao', 'addImagens'].forEach(id => {
            document.getElementById(id).value = '';
            document.getElementById(id).classList.remove('input-error');
        });
        document.getElementById('addEstoque').value = '1';
        document.getElementById('erroCodigo').style.display = 'none';

        const previewAdd = document.getElementById('previewAddContainer');
        previewAdd.innerHTML = '';
        previewAdd.style.display = 'none';

        addModal.style.display = 'flex';
    }

    function atualizarSelectMarcas() {
        const marcaAtualSelecionada = filtroMarca.value;
        const marcasUnicas = [...new Set(listaDePecas.map(p => (p.marca || '').trim()))].filter(m => m !== '').sort();

        filtroMarca.innerHTML = '<option value="">Todas as Marcas</option>';
        marcasUnicas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.toLowerCase();
            option.textContent = marca;
            filtroMarca.appendChild(option);
        });
        filtroMarca.value = marcaAtualSelecionada;
    }

    function atualizarDashboard(pecasExibidas) {
        const countElement = document.getElementById('countPecas');
        const valorTotalElement = document.getElementById('valorTotalEstoque');

        countElement.textContent = pecasExibidas.length;

        let valorTotal = pecasExibidas.reduce((acc, peca) => {
            const preco = parseFloat(String(peca.preco || 0).replace(',', '.')) || 0;
            const estoque = parseInt(peca.estoque || 0) || 0;
            return acc + (preco * estoque);
        }, 0);

        valorTotalElement.textContent = formatarMoeda(valorTotal);
    }

    function renderizarTabela(pecasParaMostrar) {
        tableBody.innerHTML = '';

        if (pecasParaMostrar.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">Nenhuma peça encontrada com esses filtros.</td></tr>`;
            atualizarDashboard([]);
            return;
        }

        let htmlRows = '';
        pecasParaMostrar.forEach(peca => {
            const qtdEstoque = parseInt(peca.estoque || 0);
            const alertaEstoque = qtdEstoque <= 1
                ? `<span class="badge-estoque-baixo" title="Estoque crítico!"><i class="fa fa-triangle-exclamation"></i> Baixo</span>`
                : '';

            htmlRows += `
                <tr data-id="${peca._id}">
                    <td>${peca.id || ''}</td>
                    <td class="nome-clicavel" title="Clique para ver os detalhes">${peca.nome || ''}</td>
                    <td>${peca.marca || ''}</td>
                    <td>
                        <div class="estoque-wrapper">
                            <span>${qtdEstoque} un.</span>
                            ${alertaEstoque}
                        </div>
                    </td>
                    <td>${formatarMoeda(peca.preco || 0)}</td>
                    <td>${peca.localizacao || ''}</td>
                    <td class="actions">
                        <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = htmlRows;
        atualizarDashboard(pecasParaMostrar);
    }

    async function carregarPecas() {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Falha na rede');
            listaDePecas = await response.json();
            atualizarSelectMarcas();
            aplicarFiltros();
        } catch (error) {
            emptyState.style.display = 'none';
            tableWrapper.style.display = 'block';
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Não foi possível conectar ao servidor.</td></tr>`;
            showToast("Erro de conexão com o banco de dados.", "error");
        }
    }

    function aplicarFiltros() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const marcaSelecionada = filtroMarca.value;
        const precoFaixa = filtroPreco.value;

        const isPesquisaAtiva = searchTerm !== '' || marcaSelecionada !== '' || precoFaixa !== '';

        if (!isPesquisaAtiva && !forcarMostrarTodos) {
            emptyState.style.display = 'flex';
            tableWrapper.style.display = 'none';
            dashboardMetrics.style.display = 'none';
            return;
        } else {
            emptyState.style.display = 'none';
            tableWrapper.style.display = 'block';
            dashboardMetrics.style.display = 'flex';
        }

        const pecasFiltradas = listaDePecas.filter(peca => {
            const nome = String(peca.nome || '').toLowerCase();
            const codigo = String(peca.id || '').toLowerCase();
            const marca = String(peca.marca || '').toLowerCase();
            const preco = parseFloat(String(peca.preco || 0).toString().replace(',', '.')) || 0;

            const matchTexto = searchTerm === '' || nome.includes(searchTerm) || codigo.includes(searchTerm) || marca.includes(searchTerm);
            const matchMarca = marcaSelecionada === '' || marca === marcaSelecionada;

            let matchPreco = true;
            if (precoFaixa === 'ate-100') {
                matchPreco = preco <= 100;
            } else if (precoFaixa === '100-500') {
                matchPreco = preco > 100 && preco <= 500;
            } else if (precoFaixa === 'acima-500') {
                matchPreco = preco > 500;
            }

            return matchTexto && matchMarca && matchPreco;
        });

        renderizarTabela(pecasFiltradas);
    }

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        forcarMostrarTodos = false;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(aplicarFiltros, 150);
    });

    filtroMarca.addEventListener('change', () => { forcarMostrarTodos = false; aplicarFiltros(); });
    filtroPreco.addEventListener('change', () => { forcarMostrarTodos = false; aplicarFiltros(); });

    function configurarPreviewFotos(inputId, containerId) {
        const input = document.getElementById(inputId);
        const container = document.getElementById(containerId);
        if (!input || !container) return;

        input.addEventListener('change', function () {
            container.innerHTML = '';
            if (this.files && this.files.length > 0) {
                container.style.display = 'flex';

                Array.from(this.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'img-thumb-wrapper';

                        const img = document.createElement('img');
                        img.src = e.target.result;

                        const btnRemover = document.createElement('button');
                        btnRemover.type = 'button';
                        btnRemover.className = 'btn-delete-photo';
                        btnRemover.title = 'Remover esta foto da seleção';
                        btnRemover.innerHTML = '<i class="fa fa-times"></i>';

                        btnRemover.onclick = function () {
                            wrapper.remove();

                            const dt = new DataTransfer();
                            for (let i = 0; i < input.files.length; i++) {
                                if (input.files[i] !== file) {
                                    dt.items.add(input.files[i]);
                                }
                            }
                            input.files = dt.files;

                            if (input.files.length === 0) {
                                container.style.display = 'none';
                            }
                        };

                        wrapper.appendChild(img);
                        wrapper.appendChild(btnRemover);
                        container.appendChild(wrapper);
                    }
                    reader.readAsDataURL(file);
                });
            } else {
                container.style.display = 'none';
            }
        });
    }

    configurarPreviewFotos('addImagens', 'previewAddContainer');
    configurarPreviewFotos('editImagens', 'previewEditContainer');

    document.querySelector('.btn-add').addEventListener('click', abrirModalAdicionar);

    function fecharAddPainel() {
        addModal.style.display = "none";
    }

    document.getElementById('fecharAddPainelTop').onclick = fecharAddPainel;
    document.getElementById('btnCancelarNovaPeca').onclick = fecharAddPainel;

    // ==========================================
    // SALVAR NOVA PEÇA (Com compressão de imagem)
    // ==========================================
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
        const btn = document.getElementById('btnSalvarNovaPeca');

        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Compactando e Salvando...';
            btn.disabled = true;

            // Compacta e anexa todas as imagens antes de enviar
            for (let i = 0; i < fileInput.files.length; i++) {
                const imagemComprimida = await comprimirImagem(fileInput.files[i]);
                formData.append('imagens', imagemComprimida);
            }

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
                        const linkElement = document.createElement('a');
                        linkElement.href = url;
                        linkElement.target = "_blank";
                        linkElement.title = "Clique para expandir a imagem";

                        const imgElement = document.createElement('img');
                        imgElement.src = url;

                        linkElement.appendChild(imgElement);
                        modalImagens.appendChild(linkElement);
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
                modal.style.display = 'flex';
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

    function renderizarFotosEdicao() {
        const container = document.getElementById('modalImagensEdicao');
        if (!container) return;

        container.innerHTML = '';
        if (imagensAtuaisEdicao.length === 0) {
            container.innerHTML = '<p style="color: #888; font-size: 0.9rem;">Nenhuma foto vinculada atualmente.</p>';
            return;
        }

        imagensAtuaisEdicao.forEach((url, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'img-thumb-wrapper';
            wrapper.innerHTML = `
                <img src="${url}" alt="Foto da Peça">
                <button type="button" class="btn-delete-photo" title="Apagar esta foto"><i class="fa fa-times"></i></button>
            `;

            wrapper.querySelector('.btn-delete-photo').onclick = function () {
                if (confirm("Deseja realmente apagar esta foto?")) {
                    imagensAtuaisEdicao.splice(index, 1);
                    renderizarFotosEdicao();
                    showToast("Foto removida da lista. Clique em Salvar para efetivar.", "warning");
                }
            };

            container.appendChild(wrapper);
        });
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

            const previewEdit = document.getElementById('previewEditContainer');
            previewEdit.innerHTML = '';
            previewEdit.style.display = 'none';

            imagensAtuaisEdicao = [];
            if (peca.imagemUrl) imagensAtuaisEdicao.push(peca.imagemUrl);
            if (peca.imagensUrls && peca.imagensUrls.length > 0) {
                imagensAtuaisEdicao = [...peca.imagensUrls];
            }

            renderizarFotosEdicao();
            modoEdicao();
        }
    };

    document.getElementById('btnCancelarEdicao').onclick = modoVisualizacao;

    // ==========================================
    // SALVAR EDIÇÃO (Com compressão de imagem)
    // ==========================================
    document.getElementById('btnSalvarEdicao').onclick = async function () {
        const formData = new FormData();
        formData.append('id', document.getElementById('editCodigo').value);
        formData.append('nome', document.getElementById('editNome').value);
        formData.append('marca', document.getElementById('editMarca').value);
        formData.append('estoque', document.getElementById('editEstoque').value);
        formData.append('preco', document.getElementById('editPreco').value.replace(',', '.'));
        formData.append('localizacao', document.getElementById('editLocalizacao').value);

        formData.append('imagensUrlsMantidas', JSON.stringify(imagensAtuaisEdicao));

        const fileInput = document.getElementById('editImagens');
        const btnSalvar = document.getElementById('btnSalvarEdicao');

        try {
            btnSalvar.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Compactando e Salvando...';
            btnSalvar.disabled = true;

            // Compacta as novas imagens inseridas na edição
            for (let i = 0; i < fileInput.files.length; i++) {
                const imagemComprimida = await comprimirImagem(fileInput.files[i]);
                formData.append('imagens', imagemComprimida);
            }

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
        modal.style.display = "none";
        modoVisualizacao();
    }

    document.getElementById('fecharPainelTop').onclick = fecharPainel;

    window.onclick = function (event) {
        if (event.target === modal) fecharPainel();
        if (event.target === addModal) fecharAddPainel();
    }

    carregarPecas();
});