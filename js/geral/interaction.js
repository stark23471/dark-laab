/*
    ARQUIVO: js/geral/interaction.js
    DESCRIÇÃO: Gerenciador de Interação (Raycaster).
    FUNÇÃO: Esta classe é responsável por "atirar um raio" (Raycast)
    a partir do centro da tela (mira) para detectar com o que
    o jogador está olhando/interagindo.
    
    COMENTÁRIOS EM: PT-BR
*/

class InteractionHandler {

    /**
     * @param {THREE.Camera} camera - A câmera do jogador (de onde o raio sai).
     * @param {THREE.Scene} scene - A cena (onde os objetos estão).
     * @param {Function} onInteractCallback - Função em 'main.js' a ser chamada
     * quando uma interação válida ocorre.
     */
    constructor(camera, scene, onInteractCallback) {
        this.camera = camera;
        this.scene = scene;
        this.onInteractCallback = onInteractCallback;

        // O Raycaster do Three.js
        this.raycaster = new THREE.Raycaster();
        
        // Coordenadas da mira (sempre [0, 0] = centro da tela)
        this.crosshairCoords = new THREE.Vector2(0, 0);

        // Distância máxima de interação (ex: 3 metros)
        this.interactionDistance = 3.0; 

        // Armazena o objeto que está atualmente na mira
        this.currentTarget = null;
    }

    /**
     * Chamado quando o jogador pressiona [E] ou o Botão de Ação.
     * Esta é a função que efetivamente "dispara" a interação.
     */
    triggerInteraction() {
        // Verifica se há um alvo válido na mira
        if (this.currentTarget) {
            // Chama a função de callback em 'main.js'
            // e passa os dados do objeto (ex: { type: 'gothic_door' })
            this.onInteractCallback(this.currentTarget.userData);
        } else {
            // (Opcional) Tocar um som de "falha" se não houver nada
            console.log("Nenhum alvo interativo ao alcance.");
        }
    }

    /**
     * Chamado a cada frame pelo 'main.js' (ANTES do update de controles).
     * Esta função *apenas* verifica o que está na mira, mas não
     * dispara a ação.
     */
    update() {
        // 1. Atualiza o raio para sair do centro da câmera
        this.raycaster.setFromCamera(this.crosshairCoords, this.camera);

        // 2. Verifica quais objetos na cena (recursivamente) o raio atinge
        // Passamos 'this.scene.children' e 'true' para verificar os filhos
        // dos grupos (World1_Group).
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Reseta o alvo atual
        this.currentTarget = null;

        // 3. Itera sobre os objetos atingidos
        for (const intersect of intersects) {
            
            // 4. Verifica se o objeto tem o 'userData' interativo
            // (Nós definimos isso em 'CenaFloresta.js')
            if (intersect.object.userData && intersect.object.userData.interactive === true) {
                
                // 5. Verifica se está dentro da distância permitida
                if (intersect.distance <= this.interactionDistance) {
                    
                    // Encontramos um alvo válido!
                    this.currentTarget = intersect.object;
                    
                    // (Opcional) Mudar a cor da mira para "ativa"
                    // document.getElementById('crosshair').style.color = 'red';
                    
                    // Para o loop assim que encontrar o primeiro alvo válido
                    break;
                }
            }
        }
        
        // Se o loop terminou e this.currentTarget ainda é nulo,
        // significa que não estamos olhando para nada interativo.
        if (this.currentTarget === null) {
            // (Opcional) Resetar a cor da mira para "passiva"
            // document.getElementById('crosshair').style.color = 'rgba(255, 255, 255, 0.7)';
        }
    }
}