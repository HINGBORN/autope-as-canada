

document.addEventListener('DOMContentLoaded', function() {
    
    // Função para formatar números como moeda (R$)
    function formatarMoeda(valor) {
        const numero = parseFloat(String(valor).replace(',', '.'));
        if (isNaN(numero)) {
            return valor;
        }
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(numero);
    }
    
    // Seleciona os elementos principais
    const addButton = document.querySelector('.btn-add');
    const searchInput = document.querySelector('.search-bar input');
    const tableBody = document.querySelector('.inventory-table tbody');

    // Lógica para Adicionar Peça
    addButton.addEventListener('click', function() {
        const newRow = tableBody.insertRow(0);
        newRow.classList.add('new-row-editing');
        newRow.innerHTML = `
            <td><input type="text" class="edit-input" placeholder="Código"></td>
            <td><input type="text" class="edit-input" placeholder="Nome da Peça"></td>
            <td><input type="text" class="edit-input" placeholder="Marca"></td>
            <td><input type="text" class="edit-input" placeholder="Quantidade"></td>
            <td><input type="text" class="edit-input" placeholder="Preço (Ex: 70 ou 45,50)"></td>
            <td><input type="text" class="edit-input" placeholder="Localização"></td>
            <td class="actions">
                <button class="btn-action btn-save-new" title="Salvar"><i class="fa fa-check"></i></button>
                <button class="btn-action btn-cancel-new" title="Cancelar"><i class="fa fa-times"></i></button>
            </td>
        `;
    });

    // Lógica da Busca
    searchInput.addEventListener('keyup', function() {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const codeCell = row.cells[0].innerText.toLowerCase();
            const nameCell = row.cells[1].innerText.toLowerCase();
            if (codeCell.includes(searchTerm) || nameCell.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // Lógica para todos os botões de ação na tabela
    tableBody.addEventListener('click', function(event) {
        const target = event.target;
        const button = target.closest('.btn-action');
        if (!button) return;
        const row = button.closest('tr');

        // Salvar NOVA linha
        if (button.classList.contains('btn-save-new')) {
            const inputs = row.querySelectorAll('.edit-input');
            let isValid = true;
            inputs.forEach((input, index) => {
                if (input.value.trim() === '') isValid = false;
                
                const cell = input.parentElement;
                if (index === 4) {
                    cell.innerText = formatarMoeda(input.value);
                } else {
                    cell.innerText = input.value;
                }
            });

            if (!isValid) {
                alert('Por favor, preencha todos os campos da nova peça.');
                row.querySelectorAll('td').forEach((cell, index) => {
                    if (index < 6) { 
                        const currentValue = cell.innerText;
                        cell.innerHTML = `<input type="text" class="edit-input" value="${currentValue}">`;
                    }
                });
                return;
            }

            row.querySelector('.actions').innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
            row.classList.remove('new-row-editing');
        }

        // Cancelar NOVA linha
        if (button.classList.contains('btn-cancel-new')) {
            row.remove();
        }

        // Excluir linha
        if (button.classList.contains('btn-delete')) {
            if (confirm('Tem certeza que deseja excluir esta peça?')) {
                row.remove();
            }
        }

        // Entrar no modo de EDIÇÃO
        if (button.classList.contains('btn-edit')) {
            const cells = row.querySelectorAll('td');
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

        // Salvar EDIÇÃO existente
        if (button.classList.contains('btn-save-edit')) {
            const inputs = row.querySelectorAll('.edit-input');
            const cells = row.querySelectorAll('td');
            inputs.forEach((input, index) => {
                const cell = cells[index];
                if (index === 4) {
                    cell.innerText = formatarMoeda(input.value);
                } else {
                    cell.innerText = input.value;
                }
            });
            const actionsCell = cells[cells.length - 1];
            actionsCell.innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
        }

        // Cancelar EDIÇÃO existente
        if (button.classList.contains('btn-cancel-edit')) {
            const inputs = row.querySelectorAll('.edit-input');
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < inputs.length; i++) {
                cells[i].innerText = inputs[i].defaultValue;
            }
            const actionsCell = cells[cells.length - 1];
            actionsCell.innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
        }
    });
});