document.addEventListener('DOMContentLoaded', async function() {
    
    const apiUrl = 'https://autopecascanada.onrender.com'; // URL da API online
    const tableBody = document.querySelector('.inventory-table tbody');

    function formatarMoeda(valor) {
        const numero = parseFloat(String(valor).replace(',', '.'));
        if (isNaN(numero)) return valor;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
    }

    function renderizarTabela(pecas) {
        tableBody.innerHTML = '';
        pecas.forEach(peca => {
            const row = tableBody.insertRow();
            row.setAttribute('data-id', peca._id); 
            row.innerHTML = `
                <td>${peca.id || ''}</td>
                <td>${peca.nome || ''}</td>
                <td>${peca.marca || ''}</td>
                <td>${peca.estoque || 0}</td>
                <td>${formatarMoeda(peca.preco || 0)}</td>
                <td>${peca.localizacao || ''}</td>
                <td class="actions">
                    <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
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
            console.error('Erro ao carregar peças:', error);
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Não foi possível conectar ao servidor. Verifique se o backend está rodando e tente novamente.</td></tr>`;
        }
    }

    const searchInput = document.querySelector('.search-bar input');
    searchInput.addEventListener('keyup', function() {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const nameCell = row.cells[1].innerText.toLowerCase();
            const codeCell = row.cells[0].innerText.toLowerCase();
            if (nameCell.includes(searchTerm) || codeCell.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    const addButton = document.querySelector('.btn-add');
    addButton.addEventListener('click', function() {
        const newRow = tableBody.insertRow(0);
        newRow.classList.add('new-row-editing');
        newRow.innerHTML = `
            <td><input type="text" class="edit-input" placeholder="Código"></td>
            <td><input type="text" class="edit-input" placeholder="Nome da Peça"></td>
            <td><input type="text" class="edit-input" placeholder="Marca"></td>
            <td><input type="text" class="edit-input" placeholder="Estoque"></td>
            <td><input type="text" class="edit-input" placeholder="Preço"></td>
            <td><input type="text" class="edit-input" placeholder="Localização"></td>
            <td class="actions">
                <button class="btn-action btn-save-new" title="Salvar"><i class="fa fa-check"></i></button>
                <button class="btn-action btn-cancel-new" title="Cancelar"><i class="fa fa-times"></i></button>
            </td>
        `;
    });
    
    tableBody.addEventListener('click', async function(event) {
        const target = event.target;
        const button = target.closest('.btn-action');
        if (!button) return;
        const row = button.closest('tr');
        const id = row.getAttribute('data-id');

        if (button.classList.contains('btn-save-new')) {
            const inputs = row.querySelectorAll('.edit-input');
            const novaPeca = {
                id: inputs[0].value,
                nome: inputs[1].value,
                marca: inputs[2].value,
                estoque: parseInt(inputs[3].value),
                preco: parseFloat(inputs[4].value.replace(',', '.')),
                localizacao: inputs[5].value
            };
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novaPeca)
                });
                if (response.ok) {
                    carregarPecas();
                } else {
                    alert('Erro ao salvar a peça.');
                }
            } catch (error) {
                alert('Não foi possível conectar ao servidor.');
            }
        }
        
        if (button.classList.contains('btn-cancel-new')) {
            row.remove();
        }

        if (button.classList.contains('btn-delete')) {
            if (confirm('Tem certeza que deseja excluir esta peça?')) {
                try {
                    const response = await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
                    if(response.ok) {
                        carregarPecas();
                    } else {
                        alert('Erro ao deletar peça.');
                    }
                } catch (error) {
                    alert('Não foi possível conectar ao servidor.');
                }
            }
        }

        if (button.classList.contains('btn-edit')) {
            const cells = row.querySelectorAll('td');
            // Armazenar os dados originais no próprio elemento de linha
            row.setAttribute('data-original-values', JSON.stringify(Array.from(cells).slice(0, 6).map(cell => cell.innerText)));
            
            for (let i = 0; i < cells.length - 1; i++) {
                const cellText = cells[i].innerText;
                const valueToEdit = (i === 4) ? cellText.replace(/[^0-9,.]/g, '').replace('.', ',') : cellText;
                cells[i].innerHTML = `<input type="text" class="edit-input" value="${valueToEdit}">`;
            }
            const actionsCell = cells[cells.length - 1];
            actionsCell.innerHTML = `
                <button class="btn-action btn-save-edit" title="Salvar"><i class="fa fa-check"></i></button>
                <button class="btn-action btn-cancel-edit" title="Cancelar"><i class="fa fa-times"></i></button>
            `;
        }
        
        if (button.classList.contains('btn-save-edit')) {
            const inputs = row.querySelectorAll('.edit-input');
            const pecaAtualizada = {
                id: inputs[0].value,
                nome: inputs[1].value,
                marca: inputs[2].value,
                estoque: parseInt(inputs[3].value),
                preco: parseFloat(inputs[4].value.replace(',', '.')),
                localizacao: inputs[5].value
            };
            try {
                const response = await fetch(`${apiUrl}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pecaAtualizada)
                });
                if (response.ok) {
                    carregarPecas();
                } else {
                    alert('Erro ao atualizar a peça.');
                }
            } catch (error) {
                alert('Não foi possível conectar ao servidor.');
            }
        }
        
        if (button.classList.contains('btn-cancel-edit')) {
            // Restaurar os valores originais em vez de recarregar a página inteira
            const originalValues = JSON.parse(row.getAttribute('data-original-values'));
            const cells = row.querySelectorAll('td');
            originalValues.forEach((value, index) => {
                cells[index].innerText = value;
            });
            // Restaurar botões
            cells[cells.length - 1].innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
        }
    });

    carregarPecas();
});