// Espera o documento HTML ser completamente carregado para então executar o código
document.addEventListener('DOMContentLoaded', function() {
    
    // Seleciona os elementos principais com os quais vamos trabalhar
    const addButton = document.querySelector('.btn-add');
    const searchInput = document.querySelector('.search-bar input');
    const tableBody = document.querySelector('.inventory-table tbody');

    // ==========================================================
    // PARTE 1: LÓGICA PARA ADICIONAR UMA NOVA PEÇA
    // ==========================================================
    addButton.addEventListener('click', function() {
        // Insere uma nova linha no topo da tabela (índice 0)
        const newRow = tableBody.insertRow(0);
        newRow.classList.add('new-row-editing'); // Adiciona uma classe para identificar que é uma linha nova

        // Insere 7 células na nova linha
        newRow.innerHTML = `
            <td><input type="text" class="edit-input" placeholder="Código"></td>
            <td><input type="text" class="edit-input" placeholder="Nome da Peça"></td>
            <td><input type="text" class="edit-input" placeholder="Marca"></td>
            <td><input type="text" class="edit-input" placeholder="Quantidade"></td>
            <td><input type="text" class="edit-input" placeholder="Preço (R$)"></td>
            <td><input type="text" class="edit-input" placeholder="Localização"></td>
            <td class="actions">
                <button class="btn-action btn-save-new" title="Salvar"><i class="fa fa-check"></i></button>
                <button class="btn-action btn-cancel-new" title="Cancelar"><i class="fa fa-times"></i></button>
            </td>
        `;
    });


    // ==========================================================
    // PARTE 2: LÓGICA PARA BUSCAR/FILTRAR PEÇAS
    // ==========================================================
    searchInput.addEventListener('keyup', function() {
        const searchTerm = searchInput.value.toLowerCase(); // Pega o texto digitado e converte para minúsculo
        const rows = tableBody.querySelectorAll('tr'); // Pega todas as linhas da tabela

        rows.forEach(row => {
            // Pega o texto da primeira (Código) e segunda (Nome) célula de cada linha
            const codeCell = row.cells[0].innerText.toLowerCase();
            const nameCell = row.cells[1].innerText.toLowerCase();

            // Se o texto buscado estiver incluso no código OU no nome, mostra a linha, senão, esconde.
            if (codeCell.includes(searchTerm) || nameCell.includes(searchTerm)) {
                row.style.display = ''; // '' reverte para o display padrão (table-row)
            } else {
                row.style.display = 'none'; // 'none' esconde o elemento
            }
        });
    });


    // ==========================================================
    // PARTE 3: LÓGICA PARA OS BOTÕES DE AÇÃO (EDITAR, EXCLUIR, SALVAR, CANCELAR)
    // ==========================================================
    tableBody.addEventListener('click', function(event) {
        const target = event.target;
        const button = target.closest('.btn-action');

        if (!button) return;

        const row = button.closest('tr');

        // --- LÓGICA PARA SALVAR UMA NOVA LINHA ---
        if (button.classList.contains('btn-save-new')) {
            const inputs = row.querySelectorAll('.edit-input');
            let isValid = true;
            inputs.forEach(input => {
                // Simples validação para não deixar campos vazios
                if(input.value.trim() === '') {
                    isValid = false;
                }
                // Transforma o input de volta em texto
                input.parentElement.innerText = input.value;
            });

            if (!isValid) {
                alert('Por favor, preencha todos os campos da nova peça.');
                 // Reverte para o estado de edição se a validação falhar
                row.querySelectorAll('td').forEach((cell, index) => {
                    if (index < 6) { // Apenas nas células de dados
                        const currentValue = cell.innerText;
                        cell.innerHTML = `<input type="text" class="edit-input" value="${currentValue}">`;
                    }
                });
                return;
            }

            // Restaura os botões de ação padrão
            row.querySelector('.actions').innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
            row.classList.remove('new-row-editing');
        }

        // --- LÓGICA PARA CANCELAR UMA NOVA LINHA ---
        if (button.classList.contains('btn-cancel-new')) {
            row.remove(); // Simplesmente remove a linha que foi criada
        }


        // As lógicas de Editar e Excluir existentes continuam aqui
        // --- LÓGICA PARA EXCLUIR ---
        if (button.classList.contains('btn-delete')) {
            if (confirm('Tem certeza que deseja excluir esta peça?')) {
                row.remove();
            }
        }

        // --- LÓGICA PARA ENTRAR NO MODO DE EDIÇÃO ---
        if (button.classList.contains('btn-edit')) {
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < cells.length - 1; i++) {
                const cellText = cells[i].innerText;
                cells[i].innerHTML = `<input type="text" class="edit-input" value="${cellText}">`;
            }
            const actionsCell = cells[cells.length - 1];
            actionsCell.innerHTML = `
                <button class="btn-action btn-save-edit" title="Salvar"><i class="fa fa-check"></i></button>
                <button class="btn-action btn-cancel-edit" title="Cancelar"><i class="fa fa-times"></i></button>
            `;
        }

        // --- LÓGICA PARA SALVAR UMA EDIÇÃO EXISTENTE ---
        if (button.classList.contains('btn-save-edit')) {
            const inputs = row.querySelectorAll('.edit-input');
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < inputs.length; i++) {
                cells[i].innerText = inputs[i].value;
            }
            const actionsCell = cells[cells.length - 1];
            actionsCell.innerHTML = `
                <button class="btn-action btn-edit" title="Editar"><i class="fa fa-pencil"></i></button>
                <button class="btn-action btn-delete" title="Excluir"><i class="fa fa-trash"></i></button>
            `;
        }

        // --- LÓGICA PARA CANCELAR UMA EDIÇÃO EXISTENTE ---
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