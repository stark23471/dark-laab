/* js/main.js
  Este é o arquivo "maestro" (orquestrador) do site.
  Ele é responsável por:
  1. Inicializar a cena 3D (importando de 'scene.js').
  2. Inicializar os controles (importando de 'controls.js').
  3. Gerenciar a interface do usuário (UI), como botões e painéis.
  4. Carregar os dados das artes (do 'arts.json').
  5. Lidar com todos os eventos do usuário (cliques, teclado).
  
  Usamos 'type="module"' no HTML para poder usar 'import' e 'export'.
*/

// Importa as classes que criamos em outros arquivos.
import { SceneManager } from './scene.js';
import { ControlsManager } from './controls.js';

// ⚠️ Substitua pelo seu número do WhatsApp e mensagem padrão:
// O número deve estar no formato internacional (ex: +5511912345678).
const WHATSAPP_NUMBER = '+5511999998888'; 
// {title} e {imageUrl} serão substituídos dinamicamente.
const MESSAGE_TEMPLATE = 'Olá! Adorei a arte "{title}". Gostaria de agendar uma sessão. (Veja a arte: {imageUrl})';

/**
 * Classe principal que gerencia toda a aplicação.
 * Agrupa toda a lógica para manter o código organizado.
 */
class App {
    /**
     * O construtor é chamado quando criamos `new App()`.
     * Ele apenas inicializa as propriedades.
     */
    constructor() {
        // Dados das artes (virão do JSON)
        this.artData = [];
        
        // Instâncias dos nossos gerenciadores
        this.sceneManager = null;
        this.controlsManager = null;
        
        // Estado da aplicação
        this.isMuted = localStorage.getItem('isMuted') === 'true'; // Verifica se já estava mudo
        this.isPanelOpen = false;
        this.isMobile = window.innerWidth <= 768; // Detecção simples de mobile
        this.currentTutorialStep = 0;
        this.isInTutorial = false;

        // Seletores de DOM (elementos HTML)
        // Guardamos eles aqui para não ter que buscar toda hora.
        this.dom = {
            landingScreen: document.getElementById('landing-screen'),
            loadingScreen: document.getElementById('loading-screen'),
            mainExperience: document.getElementById('main-experience'),
            sceneContainer: document.getElementById('scene-container'),
            
            // Botões
            btnEnter: document.getElementById('btn-enter'),
            btnTutorial: document.getElementById('btn-tutorial'),
            btnMute: document.getElementById('btn-mute'),
            btnClosePanel: document.getElementById('btn-close-panel'),
            
            // Ícones de Mudo
            iconMuted: document.getElementById('icon-muted'),
            iconUnmuted: document.getElementById('icon-unmuted'),
            
            // Painel de Detalhes
            detailPanel: document.getElementById('detail-panel'),
            panelTitle: document.getElementById('panel-title'),
            panelDescription: document.getElementById('panel-description'),
            panelImage: document.getElementById('panel-image'),
            panelWhatsapp: document.getElementById('panel-whatsapp'),

            // Tutorial
            tutorialTooltip: document.getElementById('tutorial-tooltip'),

            // Joystick (só existe em mobile)
            joystickContainer: document.getElementById('joystick-container'),
        };

        // Verificações
        if (!this.dom.sceneContainer) {
            console.error('Erro crítico: Div #scene-container não encontrada.');
            return;
        }

        // Inicia tudo
        this.init();
    }

    /**
     * Método de inicialização principal.
     * Configura os ouvintes de eventos (event listeners).
     */
    init() {
        console.log('App inicializando...');
        this.setupEventListeners();
        this.updateMuteButton();
        
        // Exemplo de como lidar com o banner de cookies (simplificado)
        const cookieBanner = document.getElementById('cookie-banner');
        const acceptCookies = document.getElementById('btn-accept-cookies');
        if (cookieBanner && acceptCookies) {
             // Lógica real de cookies seria mais complexa (verificar localStorage, etc)
            cookieBanner.classList.remove('hidden');
            acceptCookies.onclick = () => cookieBanner.classList.add('hidden');
        }
    }

    /**
     * Configura todos os cliques e eventos de teclado.
     */
    setupEventListeners() {
        // Botões da tela de Abertura
        this.dom.btnEnter.addEventListener('click', () => this.startExperience(false));
        this.dom.btnTutorial.addEventListener('click', () => this.startExperience(true));
        
        // Botões da UI
        this.dom.btnMute.addEventListener('click', () => this.toggleMute());
        this.dom.btnClosePanel.addEventListener('click', () => this.closeDetailPanel());
        
        // Eventos de Teclado (Navegação e Acessibilidade)
        window.addEventListener('keydown', (e) => {
            // Fecha o painel com "Escape"
            if (e.key === 'Escape' && this.isPanelOpen) {
                this.closeDetailPanel();
            }
            
            // Tenta interagir com "E"
            if (e.key.toLowerCase() === 'e' && !this.isPanelOpen) {
                this.tryToInteract();
            }
        });

        // Evento de clique para interação (além da tecla 'E')
        // Usamos 'mousedown' pois 'click' pode ser bloqueado pelo PointerLock
        window.addEventListener('mousedown', (e) => {
            // Se o painel estiver aberto, não tenta interagir com a cena
            if (this.isPanelOpen) return;
            // Se o clique foi no canvas 3D (e não na UI)
            if (e.target === this.dom.sceneContainer || this.dom.sceneContainer.contains(e.target)) {
                this.tryToInteract(true); // 'true' indica que foi um clique
            }
        });
    }

    /**
     * Chamado pelos botões "Entrar" ou "Tutorial".
     * @param {boolean} startWithTutorial - Se deve iniciar o tutorial.
     */
    async startExperience(startWithTutorial = false) {
        this.isInTutorial = startWithTutorial;

        // 1. Esconde a tela de Abertura e mostra o Loading
        this.dom.landingScreen.style.opacity = 0;
        this.dom.loadingScreen.classList.remove('hidden');
        
        // Espera a animação de fade-out da landing
        setTimeout(() => {
            this.dom.landingScreen.classList.add('hidden');
        }, 500); // 500ms (deve bater com a transição do CSS)

        try {
            // 2. Carrega os dados das artes
            await this.loadArtData();
            
            // 3. Inicializa o mundo 3D
            this.sceneManager = new SceneManager(this.dom.sceneContainer, this.artData, this.isMuted);
            await this.sceneManager.init(); // Espera a cena carregar
            
            // 4. Inicializa os controles
            this.controlsManager = new ControlsManager(
                this.sceneManager.getCamera(), 
                this.sceneManager.getRendererDomElement(), 
                this.isMobile,
                this.dom.joystickContainer // Passa o container do joystick
            );

            // 5. Inicia o "loop" de renderização (animação)
            this.startRenderLoop();

            // 6. Esconde o Loading e mostra a experiência 3D
            this.dom.loadingScreen.classList.add('hidden');
            this.dom.mainExperience.classList.remove('hidden');
            
            // 7. Inicia o tutorial, se aplicável
            if (this.isInTutorial) {
                this.startTutorial();
            } else {
                // Se não está no tutorial, pede o Pointer Lock (trava do mouse)
                // Apenas em desktop
                if (!this.isMobile) {
                    this.controlsManager.lockPointer();
                }
            }

        } catch (error) {
            console.error('Falha ao iniciar a experiência:', error);
            this.dom.loadingScreen.innerHTML = 'Erro ao carregar. Tente recarregar a página.';
        }
    }

    /**
     * Carrega os dados de 'data/arts.json'.
     */
    async loadArtData() {
        try {
            const response = await fetch('data/arts.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.artData = await response.json();
            console.log('Dados das artes carregados:', this.artData);
        } catch (error) {
            console.error('Não foi possível carregar data/arts.json:', error);
            // Em um app real, mostraríamos uma mensagem de erro para o usuário.
            this.artData = []; // Define como vazio para evitar mais erros.
        }
    }

    /**
     * Inicia o loop que desenha a cena 60x por segundo.
     */
    startRenderLoop() {
        // 'requestAnimationFrame' é a forma correta de fazer animações no navegador.
        // O navegador chama a função 'animate' na hora ideal.
        const animate = () => {
            requestAnimationFrame(animate); // Pede para ser chamado novamente no próximo frame
            
            const deltaTime = this.sceneManager.getDeltaTime(); // Tempo desde o último frame
            
            // Atualiza os controles (movimento do jogador)
            if (this.controlsManager) {
                this.controlsManager.update(deltaTime);
            }
            
            // Atualiza a cena (animações, luzes piscando, etc.)
            if (this.sceneManager) {
                this.sceneManager.update(deltaTime);
            }

            // Se estiver no tutorial, verifica o progresso
            if (this.isInTutorial) {
                this.updateTutorial();
            }
        };
        
        // Inicia o loop pela primeira vez
        animate();
    }

    /**
     * Lógica do Tutorial
     */
    startTutorial() {
        console.log('Iniciando tutorial...');
        this.currentTutorialStep = 1;
        this.showTutorialTooltip(
            this.isMobile 
            ? 'Use o joystick à esquerda para mover.' 
            : 'Use WASD ou Setas para mover.'
        );
    }

    /**
     * Atualiza o tutorial (chamado dentro do render loop)
     */
    updateTutorial() {
        if (this.currentTutorialStep === 1 && this.controlsManager.hasMoved()) {
            // O jogador se moveu
            this.currentTutorialStep = 2;
            this.showTutorialTooltip(
                this.isMobile 
                ? 'Arraste o lado direito da tela para olhar.' 
                : 'Mova o mouse para olhar ao redor.'
            );
        }
        
        if (this.currentTutorialStep === 2 && this.controlsManager.hasLooked()) {
            // O jogador olhou ao redor
            this.currentTutorialStep = 3;
            // Detecta a placa mais próxima
            const nearestPlaque = this.sceneManager.findNearestPlaque(this.controlsManager.getCameraPosition());
            if (nearestPlaque) {
                // Posiciona a dica perto da placa (lógica 3D -> 2D complexa, simplificada aqui)
                this.showTutorialTooltip(
                    this.isMobile 
                    ? 'Aproxime-se e TOQUE na placa para ver a arte.' 
                    : 'Aproxime-se e pressione [E] na placa para ver a arte.'
                );
            }
        }
        
        // Se o passo 3 for concluído (jogador abriu o painel), o tutorial termina
        if (this.currentTutorialStep === 3 && this.isPanelOpen) {
            this.endTutorial();
        }
    }
    
    showTutorialTooltip(text) {
        this.dom.tutorialTooltip.textContent = text;
        this.dom.tutorialTooltip.classList.remove('hidden');
    }

    endTutorial() {
        this.isInTutorial = false;
        this.dom.tutorialTooltip.classList.add('hidden');
        console.log('Tutorial finalizado.');
        // Trava o mouse se estiver no desktop
        if (!this.isMobile) {
            this.controlsManager.lockPointer();
        }
    }


    /**
     * Tenta interagir com um objeto na cena.
     * Chamado pela tecla 'E' ou por um clique.
     * @param {boolean} isClick - Se a interação foi um clique (usar raycaster do mouse).
     */
    tryToInteract(isClick = false) {
        if (!this.sceneManager || !this.controlsManager) return;

        let interactionTarget;
        
        if (this.isMobile && isClick) {
            // Em mobile, o "clique" usa a posição do toque
            const touchCoords = this.controlsManager.getLastTouchCoords();
            interactionTarget = this.sceneManager.checkInteraction(touchCoords);
        } else if (!this.isMobile && isClick && !this.controlsManager.isPointerLocked()) {
             // Em desktop, se o mouse não está travado, usa a posição do mouse
            const mouseCoords = this.controlsManager.getMouseCoords();
            interactionTarget = this.sceneManager.checkInteraction(mouseCoords);
        } else {
            // Interação "padrão" (tecla 'E' ou clique com mouse travado)
            // Usa o centro da tela (mira)
            interactionTarget = this.sceneManager.checkInteraction({ x: 0, y: 0 });
        }


        if (interactionTarget && interactionTarget.type === 'plaque') {
            console.log('Interagindo com a placa:', interactionTarget.id);
            this.openDetailPanel(interactionTarget.id);
        }
    }

    /**
     * Alterna o estado de mudo (com som / sem som).
     */
    toggleMute() {
        this.isMuted = !this.isMuted; // Inverte o valor
        localStorage.setItem('isMuted', this.isMuted); // Salva no navegador
        this.updateMuteButton();
        
        // Avisa o SceneManager para parar/iniciar os sons
        if (this.sceneManager) {
            this.sceneManager.setMute(this.isMuted);
        }
    }

    /**
     * Atualiza o ícone do botão de mudo (SVG).
     */
    updateMuteButton() {
        if (this.isMuted) {
            this.dom.iconMuted.classList.remove('hidden');
            this.dom.iconUnmuted.classList.add('hidden');
            this.dom.btnMute.setAttribute('aria-label', 'Ativar som');
        } else {
            this.dom.iconMuted.classList.add('hidden');
            this.dom.iconUnmuted.classList.remove('hidden');
            this.dom.btnMute.setAttribute('aria-label', 'Desativar som');
        }
    }

    /**
     * Abre o painel de detalhes de uma arte específica.
     * @param {string} artId - O ID da arte (ex: "art-001").
     */
    openDetailPanel(artId) {
        // Encontra a arte no nosso array de dados
        const art = this.artData.find(item => item.id === artId);
        
        if (!art) {
            console.error(`Arte com ID ${artId} não encontrada.`);
            return;
        }

        // Popula o painel com os dados
        this.dom.panelTitle.textContent = art.title;
        // Converte quebras de linha (\n) e símbolos em HTML
        const descriptionHtml = art.shortDescription
            .replace(/•/g, '<span>•</span>') // Estiliza marcadores
            .replace(/—/g, '<span>—</span>')
            .replace(/→/g, '<span>→</span>')
            .replace(/✓/g, '<span>✓</span>')
            .replace(/\n/g, '<br>'); // Converte quebra de linha
        this.dom.panelDescription.innerHTML = descriptionHtml;
        
        this.dom.panelImage.src = art.imageSrc;
        this.dom.panelImage.alt = art.imageAlt;

        // Gera o link do WhatsApp
        this.dom.panelWhatsapp.href = this.createWhatsAppLink(art);

        // Exibe o painel
        this.dom.detailPanel.classList.remove('hidden');
        // Adiciona a classe 'visible' após um pequeno delay para a animação de 'opacity' funcionar
        setTimeout(() => {
            this.dom.detailPanel.classList.add('visible');
        }, 10); // 10ms é o suficiente

        this.isPanelOpen = true;

        // Libera o mouse (PointerLock) se estiver no desktop
        if (this.controlsManager) {
            this.controlsManager.unlockPointer();
        }
        
        // Foca no botão de fechar para acessibilidade (navegação por teclado)
        this.dom.btnClosePanel.focus();

        // Se estava no tutorial, finaliza
        if (this.isInTutorial && this.currentTutorialStep === 3) {
            this.endTutorial();
        }
    }

    /**
     * Fecha o painel de detalhes.
     */
    closeDetailPanel() {
        this.dom.detailPanel.classList.remove('visible');
        
        // Espera a animação de fade-out terminar antes de adicionar 'display: none'
        setTimeout(() => {
            this.dom.detailPanel.classList.add('hidden');
        }, 300); // 300ms (definido no CSS como --transition-speed)

        this.isPanelOpen = false;

        // Trava o mouse novamente se estiver no desktop e não estiver no tutorial
        if (this.controlsManager && !this.isMobile && !this.isInTutorial) {
            this.controlsManager.lockPointer();
        }
    }

    /**
     * Cria o link formatado para o WhatsApp.
     * @param {object} art - O objeto da arte.
     * @returns {string} - A URL formatada.
     */
    createWhatsAppLink(art) {
        // Pega a URL da imagem (se não existir, usa a URL do site)
        const imageUrl = art.whatsappImageUrl || window.location.href;
        
        // Substitui os placeholders no template
        const message = MESSAGE_TEMPLATE
            .replace('{title}', art.title)
            .replace('{imageUrl}', imageUrl);
            
        // 'encodeURIComponent' é ESSENCIAL para formatar a mensagem para uma URL
        // (converte espaços em %20, etc.)
        const encodedMessage = encodeURIComponent(message);
        
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    }
}

// 
// PONTO DE ENTRADA DA APLICAÇÃO
// 
// Espera o HTML estar completamente carregado (DOM) antes de rodar o JS.
document.addEventListener('DOMContentLoaded', () => {
    // Cria uma nova instância da nossa aplicação.
    // Isso chama o 'constructor' e o 'init()' da classe App.
    const app = new App();
});