document.addEventListener('DOMContentLoaded', async function () {

    const baseUrl = 'https://autopecascanada.onrender.com';
    const apiUrl = `${baseUrl}/pecas`;
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
    const resetDbModal = document.getElementById('resetDbModal');
    const apkDownloadModal = document.getElementById('apkDownloadModal');
    const urlDownloadDiretoApk = 'https://github.com/HINGBORN/autope-as-canada/raw/main/CanadaAutoPecas.apk';

    // ==========================================
    // MODAL DE DOWNLOAD DIRETO DO APK ANDROID (1 CLIQUE OU QR CODE)
    // ==========================================
    const btnAbrirModalApk = document.getElementById('btnAbrirModalApk');
    if (btnAbrirModalApk && apkDownloadModal) {
        btnAbrirModalApk.onclick = () => {
            const qrApkContainer = document.getElementById('qrCodeDownloadApk');
            if (qrApkContainer && typeof QRCode !== 'undefined') {
                qrApkContainer.innerHTML = '';
                new QRCode(qrApkContainer, {
                    text: urlDownloadDiretoApk,
                    width: 170,
                    height: 170,
                    colorDark: '#111111',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
            apkDownloadModal.style.display = 'flex';
        };
    }

    const fecharApkModal = document.getElementById('fecharApkModal');
    if (fecharApkModal) {
        fecharApkModal.onclick = () => apkDownloadModal.style.display = 'none';
    }

    const btnEnviarApkWhats = document.getElementById('btnEnviarApkWhats');
    if (btnEnviarApkWhats) {
        btnEnviarApkWhats.onclick = () => {
            const msg = `📱 *Aplicativo Android - Canada Auto Peças (Leitor QR Code)*\n\n` +
                `Clique no link abaixo pelo celular para baixar e instalar direto (sem precisar descompactar .zip):\n` +
                `${urlDownloadDiretoApk}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        };
    }

    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('tableWrapper');
    const dashboardMetrics = document.getElementById('dashboardMetrics');

    // ==========================================
    // BOT KEEP-ALIVE NO FRONTEND (Evita Render dormir enquanto painel estiver aberto)
    // ==========================================
    async function pingServidor() {
        const badge = document.getElementById('serverStatusBadge');
        try {
            const resp = await fetch(`${baseUrl}/`, { method: 'GET' });
            if (resp.ok && badge) {
                badge.className = 'badge-server-online';
                badge.innerHTML = '<i class="fa-solid fa-bolt"></i> Servidor Online';
            }
        } catch (err) {
            if (badge) {
                badge.className = 'badge-server-waking';
                badge.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Acordando Render...';
            }
        }
    }
    // Dispara imediatamente e a cada 5 minutos
    pingServidor();
    setInterval(pingServidor, 5 * 60 * 1000);

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
    // GERADOR DE LINK CURTO ESTILO MERCADO LIVRE / SHOPEE & QR CODE ÚNICO
    // ==========================================
    function gerarLinkCurtoWhatsApp(peca) {
        // Usa sempre a rota curta do servidor Render (/p/CODIGO) que gera o Card com Foto, Nome e Preço no WhatsApp!
        const identificador = peca.id || peca._id || peca.qrToken;
        return `${baseUrl}/p/${encodeURIComponent(identificador)}`;
    }

    function gerarLinkDiretoVitrine(peca) {
        const identificador = peca.id || peca._id || peca.qrToken;
        if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            return `produto.html?id=${encodeURIComponent(identificador)}`;
        }
        const pathParts = window.location.pathname.split('/');
        pathParts.pop();
        return `${window.location.origin}${pathParts.join('/')}/produto.html?id=${encodeURIComponent(identificador)}`;
    }

    function renderizarQrCodePeca(peca) {
        const qrContainer = document.getElementById('qrcodeContainer');
        if (!qrContainer) return;
        qrContainer.innerHTML = '';

        // Link curto e único para o QR Code (funciona no App Android Flutter e na câmera normal)
        const qrUrl = gerarLinkCurtoWhatsApp(peca);

        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: qrUrl,
                width: 150,
                height: 150,
                colorDark: '#111111',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }

        document.getElementById('qrLabelNome').textContent = peca.nome || 'Peça';
        document.getElementById('qrLabelCodigo').textContent = `Cód: #${peca.id || 'N/A'}`;
        document.getElementById('qrLabelLocal').textContent = `Local: ${peca.localizacao || 'N/A'}`;

        const btnAbrirPublico = document.getElementById('btnAbrirPaginaCliente');
        if (btnAbrirPublico) {
            btnAbrirPublico.href = gerarLinkDiretoVitrine(peca);
        }
    }

    // Baixar etiqueta completa em PNG (com Nome, Código, Localização e QR Code)
    async function baixarEtiquetaPng(peca) {
        const qrImgOrCanvas = document.querySelector('#qrcodeContainer canvas') || document.querySelector('#qrcodeContainer img');
        if (!qrImgOrCanvas) {
            showToast('QR Code ainda não foi gerado.', 'warning');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 420;
        canvas.height = 520;
        const ctx = canvas.getContext('2d');

        // Fundo branco com borda
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Topo Preto e Amarelo
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(10, 10, canvas.width - 20, 65);
        ctx.fillStyle = '#FFC300';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CANADA AUTO PEÇAS', canvas.width / 2, 50);

        // Desenha o QR Code centralizado
        ctx.drawImage(qrImgOrCanvas, (canvas.width - 240) / 2, 95, 240, 240);

        // Textos da etiqueta
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 20px Arial';
        const nomeTruncado = String(peca.nome || '').length > 28
            ? String(peca.nome).substring(0, 28) + '...'
            : String(peca.nome || '');
        ctx.fillText(nomeTruncado, canvas.width / 2, 375);

        ctx.font = 'bold 24px Arial';
        ctx.fillText(`CÓD: #${peca.id || 'N/A'}`, canvas.width / 2, 415);

        ctx.fillStyle = '#444444';
        ctx.font = '18px Arial';
        ctx.fillText(`Marca: ${peca.marca || 'N/A'} | Local: ${peca.localizacao || 'N/A'}`, canvas.width / 2, 450);

        ctx.fillStyle = '#777777';
        ctx.font = '13px monospace';
        ctx.fillText(peca.qrToken || `ID-${peca._id || peca.id}`, canvas.width / 2, 485);

        const link = document.createElement('a');
        link.download = `etiqueta-qrcode-peca-${peca.id || 'item'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Etiqueta QR Code baixada com sucesso!');
    }

    function imprimirEtiquetaQr(peca) {
        const qrImgOrCanvas = document.querySelector('#qrcodeContainer canvas') || document.querySelector('#qrcodeContainer img');
        if (!qrImgOrCanvas) return;

        const dataUrl = qrImgOrCanvas.tagName.toLowerCase() === 'canvas'
            ? qrImgOrCanvas.toDataURL('image/png')
            : qrImgOrCanvas.src;

        const printWin = window.open('', '_blank', 'width=450,height=600');
        if (!printWin) {
            showToast('Permita pop-ups para imprimir a etiqueta.', 'warning');
            return;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiqueta QR - #${peca.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; padding: 15px; margin: 0; }
                    .label-box { border: 3px solid #000; width: 300px; text-align: center; border-radius: 8px; overflow: hidden; }
                    .label-top { background: #000; color: #fff; font-weight: bold; padding: 10px; font-size: 16px; letter-spacing: 1px; }
                    .label-qr { padding: 15px 0 5px 0; }
                    .label-qr img { width: 180px; height: 180px; }
                    .label-name { font-size: 16px; font-weight: bold; margin: 6px 10px; }
                    .label-code { font-size: 20px; font-weight: 900; margin: 6px 0; background: #eee; padding: 5px; }
                    .label-info { font-size: 13px; color: #333; margin: 6px 10px 12px 10px; }
                    @media print { @page { margin: 5mm; } }
                </style>
            </head>
            <body>
                <div class="label-box">
                    <div class="label-top">CANADA AUTO PEÇAS</div>
                    <div class="label-qr"><img src="${dataUrl}" /></div>
                    <div class="label-name">${peca.nome || ''}</div>
                    <div class="label-code">CÓD: #${peca.id || ''}</div>
                    <div class="label-info">Marca: ${peca.marca || 'N/A'} | Local: ${peca.localizacao || 'N/A'}</div>
                </div>
                <script>
                    window.onload = function() { window.print(); setTimeout(() => window.close(), 500); };
                <\/script>
            </body>
            </html>
        `);
        printWin.document.close();
    }

    function enviarPecaWhatsAppCliente(peca) {
        const linkCurto = gerarLinkCurtoWhatsApp(peca);
        const marcaTxt = peca.marca ? ` (${peca.marca.toUpperCase()})` : '';
        const precoTxt = formatarMoeda(peca.preco || 0);

        // Formato idêntico ao compartilhamento da Shopee:
        // O WhatsApp puxa a 1ª foto da peça para montar o Card grande no topo,
        // seguido da frase "Confira ... por R$ ... Encontre na Canada Auto Peças agora!" e o link curto no final!
        const mensagem = `Confira ${peca.nome || 'Peça Automotiva'}${marcaTxt} - Cód. #${peca.id || ''} por ${precoTxt}. Encontre na Canada Auto Peças agora!\n${linkCurto}`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
    }

    // ==========================================
    // COMPRESSOR DE IMAGENS ULTRARRÁPIDO
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
            if (resetDbModal) resetDbModal.style.display = 'none';
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

    function obterPrimeiraFoto(peca) {
        if (peca.imagensUrls && peca.imagensUrls.length > 0 && peca.imagensUrls[0]) {
            return peca.imagensUrls[0];
        }
        if (peca.imagemUrl) {
            return peca.imagemUrl;
        }
        return '';
    }

    function renderizarTabela(pecasParaMostrar) {
        tableBody.innerHTML = '';

        if (pecasParaMostrar.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888;">Nenhuma peça encontrada com esses filtros.</td></tr>`;
            atualizarDashboard([]);
            return;
        }

        let htmlRows = '';
        pecasParaMostrar.forEach(peca => {
            const qtdEstoque = parseInt(peca.estoque || 0);
            const alertaEstoque = qtdEstoque <= 1
                ? `<span class="badge-estoque-baixo" title="Estoque crítico!"><i class="fa fa-triangle-exclamation"></i> Baixo</span>`
                : '';

            const primeiraFoto = obterPrimeiraFoto(peca);
            const qtdFotos = (peca.imagensUrls && peca.imagensUrls.length) ? peca.imagensUrls.length : (peca.imagemUrl ? 1 : 0);
            const badgeQtdFotos = qtdFotos > 1 ? `<span class="thumb-count-badge">+${qtdFotos - 1}</span>` : '';

            const thumbHtml = primeiraFoto
                ? `<div class="table-thumb-box nome-clicavel" title="Clique para ver as fotos e detalhes">
                       <img src="${primeiraFoto}" alt="${peca.nome || 'Foto'}" class="table-thumb-img nome-clicavel" loading="lazy">
                       ${badgeQtdFotos}
                   </div>`
                : `<div class="table-thumb-empty nome-clicavel" title="Sem foto cadastrada - Clique para adicionar">
                       <i class="fa-regular fa-image nome-clicavel"></i>
                   </div>`;

            htmlRows += `
                <tr data-id="${peca._id}">
                    <td class="td-foto">${thumbHtml}</td>
                    <td><strong>#${peca.id || ''}</strong></td>
                    <td class="nome-clicavel" title="Clique para ver detalhes, QR Code e compartilhar">${peca.nome || ''}</td>
                    <td>${peca.marca || ''}</td>
                    <td>
                        <div class="estoque-wrapper">
                            <span>${qtdEstoque} un.</span>
                            ${alertaEstoque}
                        </div>
                    </td>
                    <td><strong>${formatarMoeda(peca.preco || 0)}</strong></td>
                    <td>${peca.localizacao || ''}</td>
                    <td class="actions">
                        <div class="actions-row">
                            <button class="btn-action btn-add-orc-quick" title="Adicionar esta peça ao Orçamento"><i class="fa-solid fa-file-invoice-dollar"></i></button>
                            <button class="btn-action btn-qr-quick" title="Ver QR Code / Etiqueta"><i class="fa-solid fa-qrcode"></i></button>
                            <button class="btn-action btn-share-quick" title="Compartilhar estilo Shopee no WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                            <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
                        </div>
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
                    };
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
    // ABRIR DETALHES DA PEÇA + QR CODE + COMPARTILHAMENTO
    // ==========================================
    function abrirDetalhesPeca(pecaClicada) {
        if (!pecaClicada) return;
        idDaPecaAberta = pecaClicada._id;
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
            <p><strong>ID QR Code:</strong> <span style="font-family:monospace; font-size:0.85rem;">${pecaClicada.qrToken || pecaClicada._id}</span></p>
        `;

        renderizarQrCodePeca(pecaClicada);

        // Eventos dos botões de QR Code e Compartilhamento
        document.getElementById('btnImprimirEtiqueta').onclick = () => imprimirEtiquetaQr(pecaClicada);
        document.getElementById('btnBaixarQrCode').onclick = () => baixarEtiquetaPng(pecaClicada);
        document.getElementById('btnEnviarWhatsCliente').onclick = () => enviarPecaWhatsAppCliente(pecaClicada);
        document.getElementById('btnCopiarLinkProduto').onclick = () => {
            const linkCliente = gerarLinkCurtoWhatsApp(pecaClicada);
            navigator.clipboard.writeText(linkCliente);
            showToast('Link curto do anúncio copiado! Cole no WhatsApp do cliente.');
        };

        // Botão Excluir Peça dentro do modal de visualização e edição
        const btnExcluirModal = document.getElementById('btnExcluirPecaModal');
        if (btnExcluirModal) {
            btnExcluirModal.onclick = async () => {
                if (confirm(`Tem certeza que deseja excluir a peça "${pecaClicada.nome}" (#${pecaClicada.id})?`)) {
                    try {
                        const response = await fetch(`${apiUrl}/${pecaClicada._id}`, { method: 'DELETE' });
                        if (response.ok) {
                            fecharPainel();
                            await carregarPecas();
                            showToast("Peça excluída do estoque com sucesso.", "warning");
                        } else {
                            showToast("Erro ao excluir peça.", "error");
                        }
                    } catch (error) {
                        showToast("Erro de conexão ao excluir peça.", "error");
                    }
                }
            };
        }

        modoVisualizacao();
        modal.style.display = 'flex';
    }

    // ==========================================
    // SALVAR NOVA PEÇA (Com compressão de imagem + abertura automática do QR Code gerado)
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

        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const qrTokenUnico = `APC-${codigoValor}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

        const formData = new FormData();
        formData.append('id', codigoValor);
        formData.append('nome', nomeValor);
        formData.append('marca', document.getElementById('addMarca').value);
        formData.append('estoque', document.getElementById('addEstoque').value);
        formData.append('preco', precoValor || 0);
        formData.append('localizacao', document.getElementById('addLocalizacao').value);
        formData.append('qrToken', qrTokenUnico);

        const fileInput = document.getElementById('addImagens');
        const btn = document.getElementById('btnSalvarNovaPeca');

        try {
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Compactando e Gerando QR Code...';
            btn.disabled = true;

            // Compacta e anexa todas as imagens antes de enviar
            for (let i = 0; i < fileInput.files.length; i++) {
                const imagemComprimida = await comprimirImagem(fileInput.files[i]);
                formData.append('imagens', imagemComprimida);
            }

            const response = await fetch(apiUrl, { method: 'POST', body: formData });
            if (response.ok) {
                const pecaCriada = await response.json();
                await carregarPecas();
                fecharAddPainel();
                showToast("Peça cadastrada e QR Code único gerado com sucesso!", "success");

                // Abre automaticamente a tela da peça recém-criada mostrando o QR Code pronto para impressão
                const pecaCompleta = listaDePecas.find(p => p._id === pecaCriada._id) || pecaCriada;
                abrirDetalhesPeca(pecaCompleta);
            } else {
                showToast("Erro ao processar as fotos ou salvar a peça.", "error");
            }
        } catch (error) {
            showToast("Servidor indisponível. Verifique o backend.", "error");
        } finally {
            btn.innerHTML = '<i class="fa fa-check"></i> Finalizar Cadastro & Gerar QR Code';
            btn.disabled = false;
        }
    };

    tableBody.addEventListener('click', async function (event) {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');
        const pecaClicada = listaDePecas.find(p => p._id === id);

        if (target.classList.contains('nome-clicavel') || target.closest('.table-thumb-box') || target.closest('.table-thumb-empty') || target.closest('.btn-qr-quick')) {
            if (pecaClicada) abrirDetalhesPeca(pecaClicada);
            return;
        }

        if (target.closest('.btn-add-orc-quick')) {
            if (pecaClicada) adicionarPecaEstoqueDiretoAoOrcamento(pecaClicada);
            return;
        }

        if (target.closest('.btn-share-quick')) {
            if (pecaClicada) enviarPecaWhatsAppCliente(pecaClicada);
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

    // ==========================================
    // ZERAR BANCO DE DADOS (Para reenviar todo o estoque novo)
    // ==========================================
    const btnZerarBanco = document.getElementById('btnZerarBanco');
    if (btnZerarBanco) {
        btnZerarBanco.onclick = () => {
            document.getElementById('inputConfirmarZerar').value = '';
            resetDbModal.style.display = 'flex';
        };
    }

    document.getElementById('fecharResetModal').onclick = () => resetDbModal.style.display = 'none';
    document.getElementById('btnCancelarZerarBanco').onclick = () => resetDbModal.style.display = 'none';

    document.getElementById('btnConfirmarZerarBanco').onclick = async function () {
        const digitado = document.getElementById('inputConfirmarZerar').value.trim().toUpperCase();
        if (digitado !== 'ZERAR') {
            showToast('Digite a palavra ZERAR para confirmar a limpeza do banco.', 'warning');
            return;
        }

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Apagando todas as peças...';

        try {
            // Tenta a rota nova de limpeza em lote; se o Render ainda estiver com o deploy antigo, apaga uma por uma
            let limpouEmLote = false;
            try {
                const respLote = await fetch(`${apiUrl}/limpar-tudo`, { method: 'DELETE' });
                if (respLote.ok) limpouEmLote = true;
            } catch (e) {}

            if (!limpouEmLote) {
                for (const peca of listaDePecas) {
                    await fetch(`${apiUrl}/${peca._id}`, { method: 'DELETE' });
                }
            }

            await carregarPecas();
            resetDbModal.style.display = 'none';
            showToast('Banco de dados zerado com sucesso! Pronto para cadastrar as peças novas.', 'success');
        } catch (error) {
            showToast('Erro ao limpar o banco de dados.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Apagar Todas as Peças Agora';
        }
    };

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

    // ==========================================
    // MÓDULO COMPLETO DE ORÇAMENTO (PEÇAS DO ESTOQUE + PEÇAS AVULSAS + SERVIÇOS)
    // ==========================================
    const orcamentoModal = document.getElementById('orcamentoModal');
    let itensDoOrcamento = [];

    function atualizarDatalistEstoqueOrcamento() {
        const datalist = document.getElementById('orcEstoqueDatalist');
        if (!datalist) return;
        datalist.innerHTML = '';
        listaDePecas.forEach(p => {
            const opt = document.createElement('option');
            const precoFmt = formatarMoeda(p.preco || 0);
            opt.value = `#${p.id} - ${p.nome} (${p.marca || 'S/M'}) - ${precoFmt}`;
            datalist.appendChild(opt);
        });
    }

    function parseMonetario(val) {
        if (typeof val === 'number') return val;
        const limpo = String(val || '0')
            .replace(/R\$\s?/gi, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim();
        const num = parseFloat(limpo);
        return isNaN(num) ? 0 : num;
    }

    function atualizarBadgeOrcamento() {
        const badge = document.getElementById('badgeCountOrcamento');
        const floatingBar = document.getElementById('floatingOrcamentoBar');
        const floatingCount = document.getElementById('floatingCartCount');
        const floatingTotal = document.getElementById('floatingCartTotal');

        const qtdTotalItens = itensDoOrcamento.reduce((acc, item) => acc + (Number(item.qtd) || 1), 0);
        const valorLiquidoTotal = itensDoOrcamento.reduce((acc, item) => {
            const bruto = (Number(item.qtd) || 1) * (Number(item.precoUnit) || 0);
            return acc + Math.max(0, bruto - (Number(item.desconto) || 0));
        }, 0);

        if (badge) {
            if (itensDoOrcamento.length > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = itensDoOrcamento.length;
            } else {
                badge.style.display = 'none';
            }
        }

        // Atualiza o Carrinho Flutuante que acompanha a rolagem da página
        if (floatingBar) {
            if (itensDoOrcamento.length > 0) {
                floatingBar.style.display = 'flex';
                if (floatingCount) floatingCount.textContent = qtdTotalItens;
                if (floatingTotal) floatingTotal.textContent = formatarMoeda(valorLiquidoTotal);
            } else {
                floatingBar.style.display = 'none';
            }
        }
    }

    function renderizarTabelaOrcamento() {
        const tbody = document.getElementById('orcTabelaItensBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        atualizarBadgeOrcamento();

        if (itensDoOrcamento.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#777; padding:18px;">Nenhum item adicionado ao orçamento ainda. Adicione peças do estoque ou peças avulsas acima.</td></tr>`;
            document.getElementById('orcSubtotalBruto').textContent = 'R$ 0,00';
            document.getElementById('orcTotalDescontos').textContent = 'R$ 0,00';
            document.getElementById('orcValorTotalFinal').textContent = 'R$ 0,00';
            return;
        }

        let somaBruto = 0;
        let somaDesconto = 0;
        let somaLiquido = 0;

        itensDoOrcamento.forEach((item, idx) => {
            const totalBrutoItem = item.qtd * item.precoUnit;
            const totalLiquidoItem = Math.max(0, totalBrutoItem - item.desconto);

            somaBruto += totalBrutoItem;
            somaDesconto += item.desconto;
            somaLiquido += totalLiquidoItem;

            const tipoBadge = item.tipo === 'servico'
                ? `<span style="background:#3498db; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">Serviço</span>`
                : (item.origem === 'estoque'
                    ? `<span style="background:#27ae60; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">Estoque</span>`
                    : `<span style="background:#e67e22; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">Avulsa</span>`);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tipoBadge}</td>
                <td><strong>${item.codigo || '-'}</strong></td>
                <td>${item.descricao}</td>
                <td>${item.qtd}</td>
                <td>${formatarMoeda(item.precoUnit)}</td>
                <td>${formatarMoeda(item.desconto)}</td>
                <td><strong>${formatarMoeda(totalLiquidoItem)}</strong></td>
                <td style="text-align:center;">
                    <button type="button" class="btn-action btn-delete" data-idx="${idx}" title="Remover item"><i class="fa fa-trash"></i></button>
                </td>
            `;
            tr.querySelector('.btn-delete').onclick = () => {
                itensDoOrcamento.splice(idx, 1);
                renderizarTabelaOrcamento();
            };
            tbody.appendChild(tr);
        });

        document.getElementById('orcSubtotalBruto').textContent = formatarMoeda(somaBruto);
        document.getElementById('orcTotalDescontos').textContent = formatarMoeda(somaDesconto);
        document.getElementById('orcValorTotalFinal').textContent = formatarMoeda(somaLiquido);
    }

    function abrirModalOrcamento() {
        atualizarDatalistEstoqueOrcamento();
        const numInput = document.getElementById('orcNumero');
        if (numInput && !numInput.value) {
            numInput.value = Math.floor(10000 + Math.random() * 90000).toString();
        }
        const valInput = document.getElementById('orcValidade');
        if (valInput && !valInput.value) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            valInput.value = d.toLocaleDateString('pt-BR');
        }
        renderizarTabelaOrcamento();
        orcamentoModal.style.display = 'flex';
    }

    function adicionarPecaEstoqueDiretoAoOrcamento(peca) {
        const precoNum = parseFloat(String(peca.preco || 0).replace(',', '.')) || 0;
        const existente = itensDoOrcamento.find(i => i.origem === 'estoque' && String(i.codigo) === String(peca.id));
        if (existente) {
            existente.qtd += 1;
        } else {
            itensDoOrcamento.push({
                tipo: 'produto',
                origem: 'estoque',
                codigo: peca.id || '-',
                descricao: `${peca.nome || ''}${peca.marca ? ' - ' + peca.marca.toUpperCase() : ''}`,
                qtd: 1,
                precoUnit: precoNum,
                desconto: 0
            });
        }
        atualizarBadgeOrcamento();
        showToast(`"${peca.nome}" adicionada ao Orçamento! Clique em "Gerar Orçamento" no topo.`, 'success');
    }

    const btnAbrirOrcamento = document.getElementById('btnAbrirOrcamento');
    if (btnAbrirOrcamento) btnAbrirOrcamento.onclick = abrirModalOrcamento;

    const btnAbrirOrcamentoFlutuante = document.getElementById('btnAbrirOrcamentoFlutuante');
    if (btnAbrirOrcamentoFlutuante) btnAbrirOrcamentoFlutuante.onclick = abrirModalOrcamento;

    const fecharOrcamentoTop = document.getElementById('fecharOrcamentoTop');
    if (fecharOrcamentoTop) fecharOrcamentoTop.onclick = () => orcamentoModal.style.display = 'none';

    const btnFecharOrcamentoFooter = document.getElementById('btnFecharOrcamentoFooter');
    if (btnFecharOrcamentoFooter) btnFecharOrcamentoFooter.onclick = () => orcamentoModal.style.display = 'none';

    // 1. Incluir peça que está cadastrada no estoque
    const btnAddPecaEstoqueOrc = document.getElementById('btnAddPecaEstoqueOrc');
    if (btnAddPecaEstoqueOrc) {
        btnAddPecaEstoqueOrc.onclick = () => {
            const textoBusca = document.getElementById('orcBuscaEstoqueInput').value.trim();
            if (!textoBusca) {
                showToast('Selecione ou digite uma peça do estoque.', 'warning');
                return;
            }

            // Extrai código se veio no formato "#19 - nome..." ou procura por código/nome
            let pecaAchada = null;
            if (textoBusca.startsWith('#')) {
                const codExtraido = textoBusca.split(' - ')[0].replace('#', '').trim();
                pecaAchada = listaDePecas.find(p => String(p.id).trim() === codExtraido);
            }
            if (!pecaAchada) {
                const termoLower = textoBusca.toLowerCase();
                pecaAchada = listaDePecas.find(p =>
                    String(p.id || '').toLowerCase() === termoLower ||
                    String(p.nome || '').toLowerCase().includes(termoLower)
                );
            }

            if (!pecaAchada) {
                showToast('Peça não encontrada no estoque. Use a opção abaixo para adicionar peça avulsa!', 'warning');
                return;
            }

            const qtd = Math.max(1, parseInt(document.getElementById('orcEstoqueQtd').value) || 1);
            const desc = parseMonetario(document.getElementById('orcEstoqueDesc').value);
            const precoUnit = parseFloat(String(pecaAchada.preco || 0).replace(',', '.')) || 0;

            itensDoOrcamento.push({
                tipo: 'produto',
                origem: 'estoque',
                codigo: pecaAchada.id || '-',
                descricao: `${pecaAchada.nome || ''}${pecaAchada.marca ? ' (' + pecaAchada.marca.toUpperCase() + ')' : ''}`,
                qtd,
                precoUnit,
                desconto: desc
            });

            document.getElementById('orcBuscaEstoqueInput').value = '';
            document.getElementById('orcEstoqueQtd').value = '1';
            document.getElementById('orcEstoqueDesc').value = '0,00';
            renderizarTabelaOrcamento();
            showToast('Peça do estoque incluída no orçamento!');
        };
    }

    // 2. Incluir peça avulsa (que NÃO tem no estoque) ou Serviço
    const btnAddPecaAvulsaOrc = document.getElementById('btnAddPecaAvulsaOrc');
    if (btnAddPecaAvulsaOrc) {
        btnAddPecaAvulsaOrc.onclick = () => {
            const tipo = document.getElementById('orcAvulsoTipo').value;
            const codigo = document.getElementById('orcAvulsoCodigo').value.trim() || 'AVULSO';
            const nome = document.getElementById('orcAvulsoNome').value.trim();
            const qtd = Math.max(1, parseFloat(document.getElementById('orcAvulsoQtd').value) || 1);
            const precoUnit = parseMonetario(document.getElementById('orcAvulsoPreco').value);
            const desconto = parseMonetario(document.getElementById('orcAvulsoDesc').value);

            if (!nome) {
                showToast('Digite a descrição da peça avulsa ou serviço.', 'warning');
                return;
            }

            itensDoOrcamento.push({
                tipo,
                origem: 'avulso',
                codigo,
                descricao: nome.toUpperCase(),
                qtd,
                precoUnit,
                desconto
            });

            document.getElementById('orcAvulsoCodigo').value = '';
            document.getElementById('orcAvulsoNome').value = '';
            document.getElementById('orcAvulsoQtd').value = '1';
            document.getElementById('orcAvulsoPreco').value = '';
            document.getElementById('orcAvulsoDesc').value = '0,00';
            renderizarTabelaOrcamento();
            showToast(tipo === 'servico' ? 'Serviço adicionado ao orçamento!' : 'Peça avulsa adicionada ao orçamento!');
        };
    }

    const btnLimparItensOrc = document.getElementById('btnLimparItensOrc');
    if (btnLimparItensOrc) {
        btnLimparItensOrc.onclick = () => {
            if (itensDoOrcamento.length > 0 && confirm('Deseja remover todos os itens deste orçamento?')) {
                itensDoOrcamento = [];
                renderizarTabelaOrcamento();
            }
        };
    }

    // 3. Gerar e Baixar Arquivo .PDF Direto (com a Logo do site e Layout igual à Folha da Foto)
    async function carregarLogoBase64() {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } catch (e) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = 'images/favicon.jpg';
        });
    }

    const btnGerarPdfDireto = document.getElementById('btnGerarPdfDireto');
    if (btnGerarPdfDireto) {
        btnGerarPdfDireto.onclick = async () => {
            if (itensDoOrcamento.length === 0) {
                showToast('Adicione pelo menos 1 item ao orçamento antes de gerar o PDF.', 'warning');
                return;
            }

            if (!window.jspdf || !window.jspdf.jsPDF) {
                showToast('Biblioteca de PDF ainda carregando, tente novamente.', 'warning');
                return;
            }

            const btnOriginalHtml = btnGerarPdfDireto.innerHTML;
            btnGerarPdfDireto.disabled = true;
            btnGerarPdfDireto.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Gerando Arquivo PDF...';

            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                const agora = new Date();
                const dataEmissao = agora.toLocaleDateString('pt-BR');
                const horaEmissao = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const d = {
                    numero: document.getElementById('orcNumero').value || '0001',
                    os: document.getElementById('orcOS').value || '-',
                    vendedor: document.getElementById('orcVendedor').value || 'ADMIN',
                    validade: document.getElementById('orcValidade').value || dataEmissao,
                    clienteNome: document.getElementById('orcClienteNome').value || 'CONSUMIDOR',
                    clienteDoc: document.getElementById('orcClienteDoc').value || '-',
                    clienteFone: document.getElementById('orcClienteFone').value || '-',
                    clienteEnd: document.getElementById('orcClienteEndereco').value || '-',
                    clienteCep: document.getElementById('orcClienteCep').value || '-',
                    veiculoMod: document.getElementById('orcVeiculoModelo').value || '-',
                    veiculoPlaca: document.getElementById('orcVeiculoPlaca').value || '-',
                    veiculoAno: document.getElementById('orcVeiculoAno').value || '-',
                    veiculoKm: document.getElementById('orcVeiculoKm').value || '-',
                    veiculoComb: document.getElementById('orcVeiculoCombustivel').value || '-',
                    veiculoChassi: document.getElementById('orcVeiculoChassi').value || '-'
                };

                const formatNum = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // 1. Logo e Cabeçalho da Loja
                const logoBase64 = await carregarLogoBase64();
                let startTextX = 12;
                if (logoBase64) {
                    doc.addImage(logoBase64, 'JPEG', 12, 10, 20, 20);
                    startTextX = 35;
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('CANADA AUTO PEÇAS', startTextX, 16);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text('Sistema de Controle de Estoque e Orçamentos', startTextX, 21);
                doc.text('Peças Novas e Usadas com Procedência e Garantia', startTextX, 26);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(`Orçamento Nº: ${d.numero}`, 198, 16, { align: 'right' });

                doc.setLineWidth(0.5);
                doc.line(12, 33, 198, 33);

                // 2. Bloco Vendedor / Emissão / OS
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text('Vendedor:', 12, 38);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.vendedor), 32, 38);

                doc.setFont('helvetica', 'bold');
                doc.text('OS:', 130, 38);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.os), 148, 38);

                doc.setFont('helvetica', 'bold');
                doc.text('Data Emissão:', 12, 43);
                doc.setFont('helvetica', 'normal');
                doc.text(`${dataEmissao}   Hora: ${horaEmissao}   Validade: ${d.validade}`, 36, 43);

                doc.setFont('helvetica', 'bold');
                doc.text('Situação:', 130, 43);
                doc.setFont('helvetica', 'normal');
                doc.text('Aberto', 148, 43);

                doc.setLineWidth(0.2);
                doc.line(12, 46, 198, 46);

                // 3. Bloco Cliente
                doc.setFont('helvetica', 'bold');
                doc.text('Cliente:', 12, 51);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.clienteNome), 32, 51);

                doc.setFont('helvetica', 'bold');
                doc.text('CNPJ/CPF:', 130, 51);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.clienteDoc), 150, 51);

                doc.setFont('helvetica', 'bold');
                doc.text('Endereço:', 12, 56);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.clienteEnd), 32, 56);

                doc.setFont('helvetica', 'bold');
                doc.text('CEP:', 130, 56);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.clienteCep), 150, 56);

                doc.setFont('helvetica', 'bold');
                doc.text('Fone/Celular:', 12, 61);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.clienteFone), 35, 61);

                doc.line(12, 64, 198, 64);

                // 4. Bloco Veículo
                doc.setFont('helvetica', 'bold');
                doc.text('Modelo:', 12, 69);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoMod), 32, 69);

                doc.setFont('helvetica', 'bold');
                doc.text('Chassi:', 130, 69);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoChassi), 150, 69);

                doc.setFont('helvetica', 'bold');
                doc.text('Placa:', 12, 74);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoPlaca), 32, 74);

                doc.setFont('helvetica', 'bold');
                doc.text('Combustível:', 130, 74);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoComb), 153, 74);

                doc.setFont('helvetica', 'bold');
                doc.text('Ano/Modelo:', 12, 79);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoAno), 34, 79);

                doc.setFont('helvetica', 'bold');
                doc.text('Km:', 130, 79);
                doc.setFont('helvetica', 'normal');
                doc.text(String(d.veiculoKm), 150, 79);

                doc.setLineWidth(0.4);
                doc.line(12, 82, 198, 82);

                let currentY = 88;
                const produtos = itensDoOrcamento.filter(i => i.tipo !== 'servico');
                const servicos = itensDoOrcamento.filter(i => i.tipo === 'servico');

                let totalProdutos = 0;
                let totalServicos = 0;
                let totalDescontos = 0;

                // 5. Tabela de Produtos
                if (produtos.length > 0) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text('Produtos', 105, currentY, { align: 'center' });
                    currentY += 3;

                    const bodyProdutos = produtos.map(p => {
                        const bruto = p.qtd * p.precoUnit;
                        const liq = Math.max(0, bruto - p.desconto);
                        totalProdutos += liq;
                        totalDescontos += p.desconto;
                        return [
                            String(p.codigo || '-'),
                            String(p.descricao || ''),
                            Number(p.qtd).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
                            formatNum(p.precoUnit),
                            formatNum(p.desconto),
                            formatNum(bruto),
                            formatNum(liq)
                        ];
                    });

                    doc.autoTable({
                        startY: currentY,
                        margin: { left: 12, right: 12 },
                        head: [['Código', 'Descrição', 'Qtdade', 'Vlr. Unit.', 'Desc.', 'Total Bruto', 'Valor Total']],
                        body: bodyProdutos,
                        theme: 'grid',
                        styles: { fontSize: 8.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
                        headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                        columnStyles: {
                            0: { cellWidth: 22 },
                            1: { cellWidth: 'auto' },
                            2: { cellWidth: 18, halign: 'right' },
                            3: { cellWidth: 22, halign: 'right' },
                            4: { cellWidth: 18, halign: 'right' },
                            5: { cellWidth: 23, halign: 'right' },
                            6: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }
                        }
                    });

                    currentY = doc.lastAutoTable.finalY + 8;
                }

                // 6. Tabela de Serviços (se houver)
                if (servicos.length > 0) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text('Serviços', 105, currentY, { align: 'center' });
                    currentY += 3;

                    const bodyServicos = servicos.map(s => {
                        const bruto = s.qtd * s.precoUnit;
                        const liq = Math.max(0, bruto - s.desconto);
                        totalServicos += liq;
                        totalDescontos += s.desconto;
                        return [
                            String(s.codigo || '-'),
                            String(s.descricao || ''),
                            formatNum(s.qtd),
                            formatNum(s.precoUnit),
                            formatNum(liq)
                        ];
                    });

                    doc.autoTable({
                        startY: currentY,
                        margin: { left: 12, right: 12 },
                        head: [['Código', 'Descrição dos serviços', 'Tempo de Serviço', 'Valor Hora', 'Valor Total']],
                        body: bodyServicos,
                        theme: 'grid',
                        styles: { fontSize: 8.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
                        headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                        columnStyles: {
                            0: { cellWidth: 22 },
                            1: { cellWidth: 'auto' },
                            2: { cellWidth: 28, halign: 'right' },
                            3: { cellWidth: 25, halign: 'right' },
                            4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
                        }
                    });

                    currentY = doc.lastAutoTable.finalY + 8;
                }

                // 7. Caixa de Totais
                const totalGeral = totalProdutos + totalServicos;
                if (currentY > 255) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFillColor(248, 248, 248);
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.4);
                doc.rect(12, currentY, 186, 12, 'FD');

                doc.setFontSize(9.5);
                doc.setFont('helvetica', 'normal');
                doc.text(`Total Produtos: R$ ${formatNum(totalProdutos)}`, 16, currentY + 7.5);
                if (servicos.length > 0) {
                    doc.text(`Total Serviços: R$ ${formatNum(totalServicos)}`, 72, currentY + 7.5);
                }
                doc.text(`Descontos: R$ ${formatNum(totalDescontos)}`, 122, currentY + 7.5);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(`VALOR TOTAL: R$ ${formatNum(totalGeral)}`, 194, currentY + 7.5, { align: 'right' });

                // 8. Assinaturas
                currentY += 32;
                if (currentY < 280) {
                    doc.setLineWidth(0.3);
                    doc.line(25, currentY, 95, currentY);
                    doc.line(115, currentY, 185, currentY);
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    doc.text('CANADA AUTO PEÇAS', 60, currentY + 4, { align: 'center' });
                    doc.text(`Cliente: ${d.clienteNome}`, 150, currentY + 4, { align: 'center' });
                }

                const nomeClienteLimpo = String(d.clienteNome).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                const nomeArquivo = `Orcamento_${d.numero}_${nomeClienteLimpo}.pdf`;

                // Salva (baixa) o arquivo .PDF diretamente no computador ou celular!
                doc.save(nomeArquivo);

                // Se estiver no celular com suporte a Web Share de arquivos, também oferece enviar o PDF direto no WhatsApp
                try {
                    const pdfBlob = doc.output('blob');
                    const pdfFile = new File([pdfBlob], nomeArquivo, { type: 'application/pdf' });
                    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                        await navigator.share({
                            files: [pdfFile],
                            title: `Orçamento Nº ${d.numero} - Canada Auto Peças`,
                            text: `Segue em anexo o Orçamento Nº ${d.numero} da Canada Auto Peças.`
                        });
                    }
                } catch (_) {}

                showToast(`PDF "${nomeArquivo}" gerado e baixado com sucesso! Agora é só anexar no WhatsApp do cliente.`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Erro ao gerar o arquivo PDF.', 'error');
            } finally {
                btnGerarPdfDireto.disabled = false;
                btnGerarPdfDireto.innerHTML = btnOriginalHtml;
            }
        };
    }

    // 4. Imprimir Folha de Orçamento A4 idêntica à foto enviada (com a logo images/favicon.jpg do site)
    const btnImprimirOrcamento = document.getElementById('btnImprimirOrcamento');
    if (btnImprimirOrcamento) {
        btnImprimirOrcamento.onclick = () => {
            if (itensDoOrcamento.length === 0) {
                showToast('Adicione pelo menos 1 produto ou serviço para imprimir o orçamento.', 'warning');
                return;
            }

            const agora = new Date();
            const dataEmissao = agora.toLocaleDateString('pt-BR');
            const horaEmissao = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const d = {
                numero: document.getElementById('orcNumero').value || '0001',
                os: document.getElementById('orcOS').value || '-',
                vendedor: document.getElementById('orcVendedor').value || 'ADMIN',
                validade: document.getElementById('orcValidade').value || dataEmissao,
                clienteNome: document.getElementById('orcClienteNome').value || 'CONSUMIDOR',
                clienteDoc: document.getElementById('orcClienteDoc').value || '-',
                clienteFone: document.getElementById('orcClienteFone').value || '-',
                clienteEnd: document.getElementById('orcClienteEndereco').value || '-',
                clienteCep: document.getElementById('orcClienteCep').value || '-',
                veiculoMod: document.getElementById('orcVeiculoModelo').value || '-',
                veiculoPlaca: document.getElementById('orcVeiculoPlaca').value || '-',
                veiculoAno: document.getElementById('orcVeiculoAno').value || '-',
                veiculoKm: document.getElementById('orcVeiculoKm').value || '-',
                veiculoComb: document.getElementById('orcVeiculoCombustivel').value || '-',
                veiculoChassi: document.getElementById('orcVeiculoChassi').value || '-'
            };

            const produtos = itensDoOrcamento.filter(i => i.tipo !== 'servico');
            const servicos = itensDoOrcamento.filter(i => i.tipo === 'servico');

            const formatNum = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            let totalProdutos = 0;
            let totalServicos = 0;
            let totalDescontos = 0;

            const linhasProdutosHtml = produtos.map(p => {
                const bruto = p.qtd * p.precoUnit;
                const liq = Math.max(0, bruto - p.desconto);
                totalProdutos += liq;
                totalDescontos += p.desconto;
                return `
                    <tr>
                        <td>${p.codigo}</td>
                        <td>${p.descricao}</td>
                        <td class="num">${Number(p.qtd).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                        <td class="num">${formatNum(p.precoUnit)}</td>
                        <td class="num">${formatNum(p.desconto)}</td>
                        <td class="num">${formatNum(bruto)}</td>
                        <td class="num">${formatNum(liq)}</td>
                    </tr>
                `;
            }).join('');

            const linhasServicosHtml = servicos.map(s => {
                const bruto = s.qtd * s.precoUnit;
                const liq = Math.max(0, bruto - s.desconto);
                totalServicos += liq;
                totalDescontos += s.desconto;
                return `
                    <tr>
                        <td>${s.codigo}</td>
                        <td>${s.descricao}</td>
                        <td class="num">${formatNum(s.qtd)}</td>
                        <td class="num">${formatNum(s.precoUnit)}</td>
                        <td class="num">${formatNum(liq)}</td>
                    </tr>
                `;
            }).join('');

            const totalGeral = totalProdutos + totalServicos;
            const logoUrl = new URL('images/favicon.jpg', window.location.href).href;

            const printWin = window.open('', '_blank', 'width=950,height=850');
            if (!printWin) {
                showToast('Permita pop-ups no navegador para abrir a folha de impressão.', 'warning');
                return;
            }

            printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento Nº ${d.numero} - Canada Auto Peças</title>
    <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
        body { padding: 10px; font-size: 11px; line-height: 1.35; background: #fff; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #000; padding-bottom: 8px; margin-bottom: 6px; }
        .company-box { display: flex; gap: 12px; align-items: center; }
        .company-logo { width: 68px; height: 68px; object-fit: cover; border-radius: 6px; border: 1px solid #000; }
        .company-info h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
        .company-info p { font-size: 10.5px; }
        .orc-number-box { text-align: right; }
        .orc-number-box h2 { font-size: 18px; font-weight: 900; }
        .meta-block { border-bottom: 1px solid #000; padding: 5px 0; display: grid; grid-template-columns: 1.6fr 1fr; gap: 6px 20px; font-size: 11px; }
        .meta-row { display: flex; gap: 6px; }
        .meta-label { font-weight: bold; min-width: 85px; }
        .section-title { text-align: center; font-size: 15px; font-weight: bold; margin: 12px 0 6px 0; }
        table.sheet-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        table.sheet-table th, table.sheet-table td { border: 1px solid #000; padding: 4px 6px; font-size: 10.5px; }
        table.sheet-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
        table.sheet-table td.num { text-align: right; white-space: nowrap; }
        .totals-box { margin-top: 14px; border: 1.5px solid #000; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: #fafafa; font-size: 12px; }
        .totals-box .grand-total { font-size: 15px; font-weight: 900; }
        .signatures { margin-top: 45px; display: flex; justify-content: space-around; text-align: center; }
        .sig-line { width: 240px; border-top: 1px solid #000; padding-top: 4px; font-size: 10.5px; }
        .no-print-bar { margin-bottom: 15px; padding: 10px; background: #1a1a1a; color: #fff; display: flex; justify-content: space-between; align-items: center; border-radius: 6px; }
        .no-print-bar button { background: #FFC300; color: #000; border: none; padding: 8px 16px; font-weight: bold; border-radius: 4px; cursor: pointer; }
        @media print { .no-print-bar { display: none; } body { padding: 0; } }
    </style>
</head>
<body>
    <div class="no-print-bar">
        <span><strong>Visualização de Impressão</strong> — Folha de Orçamento Canada Auto Peças</span>
        <button onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
    </div>

    <div class="header-top">
        <div class="company-box">
            <img src="${logoUrl}" alt="Logo Canada Auto Peças" class="company-logo">
            <div class="company-info">
                <h1>CANADA AUTO PEÇAS</h1>
                <p><strong>Sistema de Controle de Estoque e Orçamentos</strong></p>
                <p>Peças Novas e Usadas com Procedência e Garantia</p>
            </div>
        </div>
        <div class="orc-number-box">
            <h2>Orçamento Nº: ${d.numero}</h2>
        </div>
    </div>

    <div class="meta-block">
        <div class="meta-row"><span class="meta-label">Vendedor:</span> <span>${d.vendedor}</span></div>
        <div class="meta-row"><span class="meta-label">OS:</span> <span>${d.os}</span></div>
        <div class="meta-row"><span class="meta-label">Data Emissão:</span> <span>${dataEmissao} &nbsp;&nbsp; <strong>Hora:</strong> ${horaEmissao} &nbsp;&nbsp; <strong>Data Validade:</strong> ${d.validade}</span></div>
        <div class="meta-row"><span class="meta-label">Situação:</span> <span>Aberto</span></div>
    </div>

    <div class="meta-block">
        <div class="meta-row"><span class="meta-label">Cliente:</span> <span>${d.clienteNome}</span></div>
        <div class="meta-row"><span class="meta-label">CNPJ/CPF:</span> <span>${d.clienteDoc}</span></div>
        <div class="meta-row"><span class="meta-label">Endereço:</span> <span>${d.clienteEnd}</span></div>
        <div class="meta-row"><span class="meta-label">CEP:</span> <span>${d.clienteCep}</span></div>
        <div class="meta-row"><span class="meta-label">Celular/Fone:</span> <span>${d.clienteFone}</span></div>
        <div class="meta-row"></div>
    </div>

    <div class="meta-block">
        <div class="meta-row"><span class="meta-label">Modelo:</span> <span>${d.veiculoMod}</span></div>
        <div class="meta-row"><span class="meta-label">Chassi:</span> <span>${d.veiculoChassi}</span></div>
        <div class="meta-row"><span class="meta-label">Placa:</span> <span>${d.veiculoPlaca}</span></div>
        <div class="meta-row"><span class="meta-label">Combustível:</span> <span>${d.veiculoComb}</span></div>
        <div class="meta-row"><span class="meta-label">Ano / Modelo:</span> <span>${d.veiculoAno}</span></div>
        <div class="meta-row"><span class="meta-label">Km:</span> <span>${d.veiculoKm}</span></div>
    </div>

    ${produtos.length > 0 ? `
    <div class="section-title">Produtos</div>
    <table class="sheet-table">
        <thead>
            <tr>
                <th style="width: 75px;">Código</th>
                <th>Descrição</th>
                <th style="width: 65px;">Qtdade</th>
                <th style="width: 80px;">Vlr. Unit.</th>
                <th style="width: 65px;">Desc.</th>
                <th style="width: 85px;">Total Bruto</th>
                <th style="width: 85px;">Valor Total</th>
            </tr>
        </thead>
        <tbody>
            ${linhasProdutosHtml}
        </tbody>
    </table>
    ` : ''}

    ${servicos.length > 0 ? `
    <div class="section-title">Serviços</div>
    <table class="sheet-table">
        <thead>
            <tr>
                <th style="width: 75px;">Código</th>
                <th>Descrição dos serviços</th>
                <th style="width: 110px;">Tempo de Serviço</th>
                <th style="width: 90px;">Valor Hora</th>
                <th style="width: 90px;">Valor Total</th>
            </tr>
        </thead>
        <tbody>
            ${linhasServicosHtml}
        </tbody>
    </table>
    ` : ''}

    <div class="totals-box">
        <div>Total Produtos: <strong>R$ ${formatNum(totalProdutos)}</strong></div>
        ${servicos.length > 0 ? `<div>Total Serviços: <strong>R$ ${formatNum(totalServicos)}</strong></div>` : ''}
        <div>Descontos: <strong>R$ ${formatNum(totalDescontos)}</strong></div>
        <div class="grand-total">VALOR TOTAL: R$ ${formatNum(totalGeral)}</div>
    </div>

    <div class="signatures">
        <div class="sig-line">CANADA AUTO PEÇAS</div>
        <div class="sig-line">Assinatura do Cliente (${d.clienteNome})</div>
    </div>

    <script>
        window.onload = function() { setTimeout(() => window.print(), 350); };
    <\/script>
</body>
</html>`);
            printWin.document.close();
        };
    }

    // ==========================================
    // MÓDULO DE HISTÓRICO (ESTOQUE & VENDAS) E DASHBOARD GERENCIAL (CHART.JS)
    // ==========================================
    const historicoApiUrl = `${baseUrl}/historico`;
    const dashboardModal = document.getElementById('dashboardModal');
    const historicoModal = document.getElementById('historicoModal');
    let listaHistorico = [];
    let chartVendasInst = null;
    let chartMarcasInst = null;
    let chartValorMarcasInst = null;

    function obterHistoricoLocalBackup() {
        try {
            return JSON.parse(localStorage.getItem('canada_historico_backup') || '[]');
        } catch (e) {
            return [];
        }
    }

    function salvarHistoricoLocalBackup(lista) {
        try {
            localStorage.setItem('canada_historico_backup', JSON.stringify(lista.slice(0, 500)));
        } catch (e) {}
    }

    async function carregarHistorico() {
        try {
            const resp = await fetch(historicoApiUrl);
            if (resp.ok) {
                const dadosRemotos = await resp.json();
                if (Array.isArray(dadosRemotos)) {
                    listaHistorico = dadosRemotos;
                    salvarHistoricoLocalBackup(listaHistorico);
                    return;
                }
            }
        } catch (e) {}
        listaHistorico = obterHistoricoLocalBackup();
    }

    async function registrarEventoHistorico(novoEvento) {
        const eventoComData = {
            _id: 'loc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            data: new Date().toISOString(),
            ...novoEvento
        };

        try {
            const resp = await fetch(historicoApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoEvento)
            });
            if (resp.ok) {
                const salvoNoServidor = await resp.json();
                await carregarHistorico();
                await carregarPecas();
                return salvoNoServidor;
            }
        } catch (e) {}

        // Fallback imediato caso o Render ainda esteja atualizando a rota /historico
        listaHistorico.unshift(eventoComData);
        salvarHistoricoLocalBackup(listaHistorico);
        return eventoComData;
    }

    // Confirmar Venda direto de dentro do Orçamento (Registra em Vendas + Histórico de Estoque + Dá Baixa no Estoque)
    const btnFinalizarVendaOrcamento = document.getElementById('btnFinalizarVendaOrcamento');
    if (btnFinalizarVendaOrcamento) {
        btnFinalizarVendaOrcamento.onclick = async () => {
            if (itensDoOrcamento.length === 0) {
                showToast('Adicione pelo menos 1 item ao orçamento para confirmar a venda.', 'warning');
                return;
            }

            const numOrc = document.getElementById('orcNumero').value || '0001';
            const cliente = document.getElementById('orcClienteNome').value || 'Consumidor';
            const vendedor = document.getElementById('orcVendedor').value || 'Admin';

            const valorTotalVenda = itensDoOrcamento.reduce((acc, item) => {
                const bruto = (Number(item.qtd) || 1) * (Number(item.precoUnit) || 0);
                return acc + Math.max(0, bruto - (Number(item.desconto) || 0));
            }, 0);

            if (!confirm(`Confirmar a venda do Orçamento Nº ${numOrc} (${formatarMoeda(valorTotalVenda)}) e dar baixa automática das peças no estoque?`)) {
                return;
            }

            btnFinalizarVendaOrcamento.disabled = true;
            const originalHtml = btnFinalizarVendaOrcamento.innerHTML;
            btnFinalizarVendaOrcamento.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Registrando Venda e Baixando Estoque...';

            try {
                const resumoNomes = itensDoOrcamento.map(i => `${i.qtd}x ${i.descricao}`).join(', ');
                const qtdTotalPecas = itensDoOrcamento.reduce((acc, i) => acc + (Number(i.qtd) || 1), 0);

                await registrarEventoHistorico({
                    tipo: 'venda',
                    codigoPeca: `ORC-${numOrc}`,
                    nomePeca: resumoNomes,
                    quantidade: qtdTotalPecas,
                    valorUnitario: valorTotalVenda,
                    valorTotal: valorTotalVenda,
                    motivo: `Venda Confirmada — Orçamento Nº ${numOrc}`,
                    cliente,
                    vendedor,
                    orcamentoNumero: numOrc,
                    baixarEstoque: true,
                    itensVenda: itensDoOrcamento.map(i => ({
                        codigo: i.codigo,
                        descricao: i.descricao,
                        qtd: i.qtd,
                        precoUnit: i.precoUnit,
                        desconto: i.desconto,
                        total: Math.max(0, (i.qtd * i.precoUnit) - i.desconto)
                    }))
                });

                showToast(`Venda do Orçamento Nº ${numOrc} registrada no Histórico e estoque atualizado!`, 'success');
            } catch (e) {
                showToast('Erro ao registrar venda.', 'error');
            } finally {
                btnFinalizarVendaOrcamento.disabled = false;
                btnFinalizarVendaOrcamento.innerHTML = originalHtml;
            }
        };
    }

    // ==========================================
    // RENDERIZAÇÃO DO HISTÓRICO (2 ABAS: ESTOQUE & VENDAS)
    // ==========================================
    function formatarDataHoraBR(isoStr) {
        if (!isoStr) return '-';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '-';
        return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    function renderizarTabelasHistorico() {
        const tbodyEstoque = document.getElementById('tabelaHistEstoqueBody');
        const tbodyVendas = document.getElementById('tabelaHistVendasBody');
        const totalVendidoEl = document.getElementById('histTotalGeralVendido');

        // 1. Filtra Saídas de Estoque (inclui saídas manuais e vendas que tiraram peça do estoque)
        const registrosSaida = listaHistorico.filter(r => r.tipo === 'saida_estoque' || r.tipo === 'venda');
        if (tbodyEstoque) {
            tbodyEstoque.innerHTML = '';
            if (registrosSaida.length === 0) {
                tbodyEstoque.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#777; padding:18px;">Nenhuma saída de estoque registrada ainda.</td></tr>`;
            } else {
                registrosSaida.forEach(reg => {
                    const tr = document.createElement('tr');
                    const isVenda = reg.tipo === 'venda' || String(reg.motivo || '').toLowerCase().includes('venda');
                    const badgeMotivo = isVenda
                        ? `<span style="background:#27ae60; color:#fff; padding:3px 9px; border-radius:12px; font-size:0.78rem; font-weight:700;"><i class="fa-solid fa-tag"></i> ${reg.motivo || 'Saída por Venda'}</span>`
                        : `<span style="background:#e67e22; color:#fff; padding:3px 9px; border-radius:12px; font-size:0.78rem; font-weight:700;"><i class="fa-solid fa-box-open"></i> ${reg.motivo || 'Baixa de Estoque'}</span>`;

                    tr.innerHTML = `
                        <td style="white-space:nowrap;">${formatarDataHoraBR(reg.data)}</td>
                        <td><strong>#${reg.codigoPeca || '-'}</strong></td>
                        <td>${reg.nomePeca || '-'}</td>
                        <td><strong>-${reg.quantidade || 1} un.</strong></td>
                        <td>${badgeMotivo}${reg.cliente && reg.cliente !== 'Consumidor' ? `<br><small style="color:#555;">Cliente: ${reg.cliente}</small>` : ''}</td>
                        <td><strong>${formatarMoeda(reg.valorTotal || 0)}</strong></td>
                        <td style="text-align:center;">
                            <button type="button" class="btn-action btn-delete" title="Apagar registro"><i class="fa fa-trash"></i></button>
                        </td>
                    `;
                    tr.querySelector('.btn-delete').onclick = () => excluirRegistroHistorico(reg._id);
                    tbodyEstoque.appendChild(tr);
                });
            }
        }

        // 2. Filtra Histórico de Vendas / Compras dos Clientes
        const registrosVendas = listaHistorico.filter(r =>
            r.tipo === 'venda' ||
            String(r.motivo || '').toLowerCase().includes('venda')
        );

        let somaTotalVendas = 0;
        if (tbodyVendas) {
            tbodyVendas.innerHTML = '';
            if (registrosVendas.length === 0) {
                tbodyVendas.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#777; padding:18px;">Nenhuma venda registrada ainda. Registre uma saída por venda ou confirme um Orçamento!</td></tr>`;
            } else {
                registrosVendas.forEach(reg => {
                    const vlr = Number(reg.valorTotal) || 0;
                    somaTotalVendas += vlr;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="white-space:nowrap;">${formatarDataHoraBR(reg.data)}</td>
                        <td><strong>${reg.cliente || 'Consumidor'}</strong></td>
                        <td>
                            <strong>${reg.nomePeca || '-'}</strong>
                            <br><small style="color:#666;">Cód: #${reg.codigoPeca || '-'} • Qtd: ${reg.quantidade || 1} un. • ${reg.motivo || 'Venda'}</small>
                        </td>
                        <td>${reg.vendedor || 'Admin'}</td>
                        <td><strong style="color:#27ae60; font-size:1rem;">${formatarMoeda(vlr)}</strong></td>
                        <td style="text-align:center;">
                            <button type="button" class="btn-action btn-delete" title="Apagar registro"><i class="fa fa-trash"></i></button>
                        </td>
                    `;
                    tr.querySelector('.btn-delete').onclick = () => excluirRegistroHistorico(reg._id);
                    tbodyVendas.appendChild(tr);
                });
            }
        }

        if (totalVendidoEl) {
            totalVendidoEl.textContent = formatarMoeda(somaTotalVendas);
        }
    }

    async function excluirRegistroHistorico(idReg) {
        if (!confirm('Deseja remover este registro do histórico?')) return;
        try {
            if (idReg && !String(idReg).startsWith('loc_')) {
                await fetch(`${historicoApiUrl}/${idReg}`, { method: 'DELETE' });
            }
        } catch (e) {}
        listaHistorico = listaHistorico.filter(r => r._id !== idReg);
        salvarHistoricoLocalBackup(listaHistorico);
        renderizarTabelasHistorico();
        showToast('Registro removido do histórico.', 'warning');
    }

    // Alternar entre os 2 botões dentro do Histórico (Histórico de Estoque vs Histórico de Compra/Vendas)
    const tabBtnHistEstoque = document.getElementById('tabBtnHistEstoque');
    const tabBtnHistVendas = document.getElementById('tabBtnHistVendas');
    const abaHistoricoEstoque = document.getElementById('abaHistoricoEstoque');
    const abaHistoricoVendas = document.getElementById('abaHistoricoVendas');

    if (tabBtnHistEstoque && tabBtnHistVendas) {
        tabBtnHistEstoque.onclick = () => {
            tabBtnHistEstoque.classList.add('active');
            tabBtnHistVendas.classList.remove('active');
            abaHistoricoEstoque.style.display = 'block';
            abaHistoricoVendas.style.display = 'none';
        };
        tabBtnHistVendas.onclick = () => {
            tabBtnHistVendas.classList.add('active');
            tabBtnHistEstoque.classList.remove('active');
            abaHistoricoVendas.style.display = 'block';
            abaHistoricoEstoque.style.display = 'none';
        };
    }

    const btnAbrirHistorico = document.getElementById('btnAbrirHistorico');
    if (btnAbrirHistorico) {
        btnAbrirHistorico.onclick = async () => {
            atualizarDatalistEstoqueOrcamento();
            await carregarHistorico();
            renderizarTabelasHistorico();
            historicoModal.style.display = 'flex';
        };
    }

    const fecharHistoricoTop = document.getElementById('fecharHistoricoTop');
    if (fecharHistoricoTop) fecharHistoricoTop.onclick = () => historicoModal.style.display = 'none';

    // Registrar nova Saída/Baixa de Estoque manualmente
    const btnRegistrarSaidaEstoque = document.getElementById('btnRegistrarSaidaEstoque');
    if (btnRegistrarSaidaEstoque) {
        btnRegistrarSaidaEstoque.onclick = async () => {
            const textoPeca = document.getElementById('histSaidaPecaInput').value.trim();
            if (!textoPeca) {
                showToast('Selecione a peça que está saindo do estoque.', 'warning');
                return;
            }

            let pecaAlvo = null;
            if (textoPeca.startsWith('#')) {
                const codExtraido = textoPeca.split(' - ')[0].replace('#', '').trim();
                pecaAlvo = listaDePecas.find(p => String(p.id).trim() === codExtraido);
            }
            if (!pecaAlvo) {
                const termo = textoPeca.toLowerCase();
                pecaAlvo = listaDePecas.find(p =>
                    String(p.id || '').toLowerCase() === termo ||
                    String(p.nome || '').toLowerCase().includes(termo)
                );
            }

            if (!pecaAlvo) {
                showToast('Peça não encontrada no estoque.', 'warning');
                return;
            }

            const qtdSaida = Math.max(1, parseInt(document.getElementById('histSaidaQtd').value) || 1);
            const motivo = document.getElementById('histSaidaMotivo').value;
            const cliente = document.getElementById('histSaidaCliente').value.trim() || 'Consumidor';
            const precoUnit = parseFloat(String(pecaAlvo.preco || 0).replace(',', '.')) || 0;
            const isMotivoVenda = motivo.toLowerCase().includes('venda');

            btnRegistrarSaidaEstoque.disabled = true;
            btnRegistrarSaidaEstoque.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';

            try {
                // Atualiza também o estoque via PUT caso a rota /historico ainda esteja subindo no Render
                const novoEstoque = Math.max(0, (parseInt(pecaAlvo.estoque) || 0) - qtdSaida);
                const fd = new FormData();
                fd.append('id', pecaAlvo.id || '');
                fd.append('nome', pecaAlvo.nome || '');
                fd.append('marca', pecaAlvo.marca || '');
                fd.append('estoque', novoEstoque);
                fd.append('preco', precoUnit);
                fd.append('localizacao', pecaAlvo.localizacao || '');
                fd.append('imagensUrlsMantidas', JSON.stringify(pecaAlvo.imagensUrls || (pecaAlvo.imagemUrl ? [pecaAlvo.imagemUrl] : [])));
                await fetch(`${apiUrl}/${pecaAlvo._id}`, { method: 'PUT', body: fd }).catch(() => {});

                await registrarEventoHistorico({
                    tipo: isMotivoVenda ? 'venda' : 'saida_estoque',
                    pecaId: pecaAlvo._id,
                    codigoPeca: pecaAlvo.id,
                    nomePeca: pecaAlvo.nome,
                    marca: pecaAlvo.marca,
                    quantidade: qtdSaida,
                    valorUnitario: precoUnit,
                    valorTotal: precoUnit * qtdSaida,
                    motivo,
                    cliente,
                    vendedor: 'Admin',
                    baixarEstoque: false // Já descontou via PUT acima para evitar desconto duplo
                });

                await carregarPecas();
                document.getElementById('histSaidaPecaInput').value = '';
                document.getElementById('histSaidaQtd').value = '1';
                document.getElementById('histSaidaCliente').value = '';
                renderizarTabelasHistorico();
                showToast(`Saída de ${qtdSaida} un. de "${pecaAlvo.nome}" registrada e estoque atualizado!`, 'success');
            } finally {
                btnRegistrarSaidaEstoque.disabled = false;
                btnRegistrarSaidaEstoque.innerHTML = '<i class="fa-solid fa-check"></i> Registrar Saída';
            }
        };
    }

    // ==========================================
    // DASHBOARD GERENCIAL COM GRÁFICOS (CHART.JS)
    // ==========================================
    async function abrirDashboardGerencial() {
        await carregarHistorico();
        dashboardModal.style.display = 'flex';

        const agora = new Date();
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();

        // 1. Cálculo de Vendas e Saídas no Mês Atual
        let valorVendasMes = 0;
        let qtdVendasMes = 0;
        let qtdPecasSairamMes = 0;

        listaHistorico.forEach(reg => {
            const d = new Date(reg.data);
            if (!isNaN(d.getTime()) && d.getMonth() === mesAtual && d.getFullYear() === anoAtual) {
                const isVenda = reg.tipo === 'venda' || String(reg.motivo || '').toLowerCase().includes('venda');
                if (isVenda) {
                    valorVendasMes += (Number(reg.valorTotal) || 0);
                    qtdVendasMes += 1;
                }
                qtdPecasSairamMes += (Number(reg.quantidade) || 1);
            }
        });

        // 2. Cálculo de Estoque Total e Peças com Pouco Estoque (<= 1 un.)
        let valorTotalEstoque = 0;
        let totalUnidadesEstoque = 0;
        const pecasEstoqueBaixo = [];
        const contagemPorMarca = {};
        const valorPorMarca = {};

        listaDePecas.forEach(p => {
            const qtd = parseInt(p.estoque || 0) || 0;
            const preco = parseFloat(String(p.preco || 0).replace(',', '.')) || 0;
            valorTotalEstoque += (qtd * preco);
            totalUnidadesEstoque += qtd;

            if (qtd <= 1) {
                pecasEstoqueBaixo.push(p);
            }

            const marcaLimpa = (p.marca || 'Outros').trim();
            const marcaFormatada = marcaLimpa ? (marcaLimpa.charAt(0).toUpperCase() + marcaLimpa.slice(1).toLowerCase()) : 'Outros';
            contagemPorMarca[marcaFormatada] = (contagemPorMarca[marcaFormatada] || 0) + 1;
            valorPorMarca[marcaFormatada] = (valorPorMarca[marcaFormatada] || 0) + (qtd * preco);
        });

        // Atualiza Cards KPIs
        document.getElementById('kpiVendasMesValor').textContent = formatarMoeda(valorVendasMes);
        document.getElementById('kpiVendasMesQtd').textContent = `${qtdVendasMes} vendas registradas neste mês`;
        document.getElementById('kpiValorTotalEstoque').textContent = formatarMoeda(valorTotalEstoque);
        document.getElementById('kpiTotalItensEstoque').textContent = `${listaDePecas.length} cadastros (${totalUnidadesEstoque} un.)`;
        document.getElementById('kpiEstoqueBaixoCount').textContent = `${pecasEstoqueBaixo.length} peças`;
        document.getElementById('kpiSaidasMesCount').textContent = `${qtdPecasSairamMes} un.`;

        // Preenche Tabela de Peças com Pouco Estoque
        const tbodyBaixo = document.getElementById('dashTabelaEstoqueBaixo');
        if (tbodyBaixo) {
            tbodyBaixo.innerHTML = '';
            if (pecasEstoqueBaixo.length === 0) {
                tbodyBaixo.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#27ae60; font-weight:700;">Nenhuma peça com estoque baixo! Tudo abastecido.</td></tr>`;
            } else {
                pecasEstoqueBaixo.slice(0, 40).forEach(p => {
                    const qtd = parseInt(p.estoque || 0) || 0;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>#${p.id || '-'}</strong></td>
                        <td>${p.nome || '-'}</td>
                        <td>${p.marca || '-'}</td>
                        <td><span class="badge-estoque-baixo" style="background:${qtd === 0 ? '#e74c3c' : '#ffc107'}; color:${qtd === 0 ? '#fff' : '#000'};">${qtd} un.</span></td>
                        <td>${p.localizacao || '-'}</td>
                    `;
                    tbodyBaixo.appendChild(tr);
                });
            }
        }

        if (typeof Chart === 'undefined') return;

        // 3. Gráfico 1: Vendas dos Últimos 6 Meses
        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const labelsMeses = [];
        const valoresMeses = [];

        for (let i = 5; i >= 0; i--) {
            const dRef = new Date(anoAtual, mesAtual - i, 1);
            const m = dRef.getMonth();
            const a = dRef.getFullYear();
            labelsMeses.push(`${nomesMeses[m]}/${String(a).slice(-2)}`);

            let somaM = 0;
            listaHistorico.forEach(reg => {
                const d = new Date(reg.data);
                const isVenda = reg.tipo === 'venda' || String(reg.motivo || '').toLowerCase().includes('venda');
                if (isVenda && !isNaN(d.getTime()) && d.getMonth() === m && d.getFullYear() === a) {
                    somaM += (Number(reg.valorTotal) || 0);
                }
            });
            valoresMeses.push(somaM);
        }

        const ctxVendas = document.getElementById('chartVendasMes');
        if (ctxVendas) {
            if (chartVendasInst) chartVendasInst.destroy();
            chartVendasInst = new Chart(ctxVendas, {
                type: 'bar',
                data: {
                    labels: labelsMeses,
                    datasets: [{
                        label: 'Vendas no Mês (R$)',
                        data: valoresMeses,
                        backgroundColor: '#27ae60',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // 4. Gráfico 2: Distribuição do Estoque por Marca (Top 7)
        const marcasOrdenadasQtd = Object.entries(contagemPorMarca)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);

        const ctxMarcas = document.getElementById('chartEstoqueMarcas');
        if (ctxMarcas) {
            if (chartMarcasInst) chartMarcasInst.destroy();
            chartMarcasInst = new Chart(ctxMarcas, {
                type: 'doughnut',
                data: {
                    labels: marcasOrdenadasQtd.map(e => e[0]),
                    datasets: [{
                        data: marcasOrdenadasQtd.map(e => e[1]),
                        backgroundColor: ['#FFC300', '#1a1a1a', '#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#e67e22']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }

        // 5. Gráfico 3: Top Marcas por Valor em Estoque (R$)
        const marcasOrdenadasValor = Object.entries(valorPorMarca)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        const ctxValorMarcas = document.getElementById('chartValorMarcas');
        if (ctxValorMarcas) {
            if (chartValorMarcasInst) chartValorMarcasInst.destroy();
            chartValorMarcasInst = new Chart(ctxValorMarcas, {
                type: 'bar',
                data: {
                    labels: marcasOrdenadasValor.map(e => e[0]),
                    datasets: [{
                        label: 'Valor em Estoque (R$)',
                        data: marcasOrdenadasValor.map(e => e[1]),
                        backgroundColor: '#1a1a1a',
                        borderColor: '#FFC300',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    const btnAbrirDashboard = document.getElementById('btnAbrirDashboard');
    if (btnAbrirDashboard) btnAbrirDashboard.onclick = abrirDashboardGerencial;

    const fecharDashboardTop = document.getElementById('fecharDashboardTop');
    if (fecharDashboardTop) fecharDashboardTop.onclick = () => dashboardModal.style.display = 'none';

    window.onclick = function (event) {
        if (event.target === modal) fecharPainel();
        if (event.target === addModal) fecharAddPainel();
        if (event.target === resetDbModal) resetDbModal.style.display = 'none';
        if (event.target === apkDownloadModal) apkDownloadModal.style.display = 'none';
        if (event.target === orcamentoModal) orcamentoModal.style.display = 'none';
        if (event.target === dashboardModal) dashboardModal.style.display = 'none';
        if (event.target === historicoModal) historicoModal.style.display = 'none';
    };

    await carregarPecas();

    // Se a URL tiver ?novo=1 (vindo do botão Cadastrar Peça com Fotos do App Android), abre direto o modal de cadastro!
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('novo') === '1') {
        abrirModalAdicionar();
    }

    // Se a URL tiver ?peca=ID ou ?qr=ID, já abre direto a peça correspondente!
    const openId = urlParams.get('peca') || urlParams.get('id') || urlParams.get('qr');
    if (openId && listaDePecas.length > 0) {
        const encontrada = listaDePecas.find(p =>
            String(p._id) === String(openId) ||
            String(p.id) === String(openId) ||
            String(p.qrToken) === String(openId)
        );
        if (encontrada) {
            forcarMostrarTodos = true;
            aplicarFiltros();
            abrirDetalhesPeca(encontrada);
        }
    }
});
