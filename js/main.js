/* js/main.js
  Este é o arquivo "maestro" (orquestrador) do site.
  ⚠️ ALTERAÇÃO: Adicionado 'actionButton' e 'onWindowResize'
  para corrigir bugs de mobile e de tela cheia.
*/

// Importa as classes que criamos em outros arquivos.
import { SceneManager } from './scene.js';
import { ControlsManager } from './controls.js';

// ⚠️ Substitua pelo seu número do WhatsApp e mensagem padrão:
const WHATSAPP_NUMBER = '+5511999998888'; 
const MESSAGE_TEMPLATE = 'Olá! Adorei a arte "{title}". Gostaria de agendar uma sessão. (Veja a arte: {imageUrl})';

/**
 * Classe principal que gerencia toda a aplicação.
 */
class App {
    /**
     * O construtor é chamado quando criamos `new App()`.
     */
    constructor() {
        // Dados das artes (virão do JSON)
        this.artData = [];
        
        // Instâncias dos nossos gerenciadores
        this.sceneManager = null;
        this.controlsManager = null;
        
        // Estado da aplicação
        this.isMuted = localStorage.getItem('isMuted') === 'true'; 
        this.isPanelOpen = false;
        // ⚠️ DETECÇÃO DE MOBILE MELHORADA (baseada em 'touch' em vez de 'width')
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.currentTutorialStep = 0;
        this.isInTutorial = false;

        // Seletores de DOM (elementos HTML)
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
            
            // ⚠️ ADICIONADO: Botão de Ação
            actionButton: document.getElementById('action-btn'),

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

            // D-Pad
            dpadContainer: document.getElementById('dpad-container'),
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
     */
    init() {
        console.log('App inicializando...');
        this.setupEventListeners();
        this.updateMuteButton();
        
        // Lida com o banner de cookies
        const cookieBanner = document.getElementById('cookie-banner');
        const acceptCookies = document.getElementById('btn-accept-cookies');
        if (cookieBanner && acceptCookies) {
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
        
        // ⚠️ ADICIONADO: Listener para o Botão de Ação (Mobile)
        if (this.isMobile && this.dom.actionButton) {
            this.dom.actionButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                // Chama a interação, que usará a mira ({x:0, y:0})
                this.tryToInteract(); 
            }, { passive: false });
        }

        // Eventos de Teclado (Navegação e Acessibilidade)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPanelOpen) {
                this.closeDetailPanel();
            }
            if (e.key.toLowerCase() === 'e' && !this.isPanelOpen) {
                this.tryToInteract();
            }
        });

        // Evento de clique para interação (Desktop)
        // ⚠️ ALTERAÇÃO: Modificado para ignorar cliques no mobile
        window.addEventListener('mousedown', (e) => {
            // Se for mobile, ignore. O "action-btn" fará a interação.
            if (this.isMobile) return; 
            
            if (this.isPanelOpen) return;
            if (e.target === this.dom.sceneContainer || this.dom.sceneContainer.contains(e.target)) {
                this.tryToInteract(true); // 'true' = clique do mouse
            }
        });
    }

    /**
     * Chamado pelos botões "Entrar" ou "Tutorial".
     */
    async startExperience(startWithTutorial = false) {
        this.isInTutorial = startWithTutorial;

        // 1. Esconde a tela de Abertura e mostra o Loading
        this.dom.landingScreen.style.opacity = 0;
        this.dom.loadingScreen.classList.remove('hidden');
        
        setTimeout(() => {
            this.dom.landingScreen.classList.add('hidden');
        }, 500); 

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
                this.dom.dpadContainer // Passa o container do D-Pad
            );

            // 5. Inicia o "loop" de renderização (animação)
            this.startRenderLoop();

            // 6. Esconde o Loading e mostra a experiência 3D
            this.dom.loadingScreen.classList.add('hidden');
            this.dom.mainExperience.classList.remove('hidden');
            
            // -----------------------------------------------------------------
            // ⚠️ CORREÇÃO CRÍTICA (PARA O BUG DO RESIZE / TELA CHEIA)
            // -----------------------------------------------------------------
            if (this.sceneManager) {
                this.sceneManager.onWindowResize();
            }
            // -----------------------------------------------------------------

            // 7. Inicia o tutorial, se aplicável
            if (this.isInTutorial) {
                this.startTutorial();
            } else {
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
            this.artData = [];
        }
    }

    /**
     * Inicia o loop que desenha a cena 60x por segundo.
     */
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate); 
            
            if (!this.sceneManager) return; 
            
            const deltaTime = this.sceneManager.getDeltaTime();
            
            if (this.controlsManager) {
                this.controlsManager.update(deltaTime);
            }
            
            if (this.sceneManager) {
                this.sceneManager.update(deltaTime);
            }

            if (this.isInTutorial) {
                this.updateTutorial();
            }
        };
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
            ? 'Use os botões para mover.' // ⚠️ Texto atualizado
            : 'Use WASD ou Setas para mover.'
        );
    }

    /**
     * Atualiza o tutorial (chamado dentro do render loop)
     */
    updateTutorial() {
        if (this.currentTutorialStep === 1 && this.controlsManager.hasMoved()) {
            this.currentTutorialStep = 2;
            this.showTutorialTooltip(
                this.isMobile 
                ? 'Arraste o lado direito da tela para olhar.' 
                : 'Mova o mouse para olhar ao redor.'
            );
        }
        
        if (this.currentTutorialStep === 2 && this.controlsManager.hasLooked()) {
            this.currentTutorialStep = 3;
            const nearestPlaque = this.sceneManager.findNearestPlaque(this.controlsManager.getCameraPosition());
            if (nearestPlaque) {
                this.showTutorialTooltip(
                    this.isMobile 
                    // ⚠️ Texto atualizado
                    ? 'Aproxime-se e use o botão ✋ para ver a arte.' 
                    : 'Aproxime-se e pressione [E] na placa para ver a arte.'
                );
            }
        }
        
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
        if (!this.isMobile) {
            this.controlsManager.lockPointer();
        }
    }


    /**
     * Tenta interagir com um objeto na cena.
     */
    tryToInteract(isClick = false) {
        if (!this.sceneManager || !this.controlsManager) return;

        let interactionTarget;
        
        // ⚠️ ALTERAÇÃO: Lógica de clique/toque simplificada.
        
        if (!this.isMobile && isClick && !this.controlsManager.isPointerLocked()) {
             // 1. Clique do mouse (Desktop, mouse destravado)
            const mouseCoords = this.controlsManager.getMouseCoords();
            interactionTarget = this.sceneManager.checkInteraction(mouseCoords);
        } else {
            // 2. Tecla 'E' (Desktop), clique com mouse travado, ou botão ✋ (Mobile)
            // Todos usam a mira central ({x: 0, y: 0})
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
        this.isMuted = !this.isMuted; 
        localStorage.setItem('isMuted', this.isMuted);
        this.updateMuteButton();
        
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
     */
    openDetailPanel(artId) {
        const art = this.artData.find(item => item.id === artId);
        if (!art) {
            console.error(`Arte com ID ${artId} não encontrada.`);
            return;
        }

        // Popula o painel com os dados
        this.dom.panelTitle.textContent = art.title;
        const descriptionHtml = art.shortDescription
            .replace(/•/g, '<span>•</span>')
            .replace(/—/g, '<span>—</span>')
            .replace(/→/g, '<span>→</span>')
            .replace(/✓/g, '<span>✓</span>')
            .replace(/\n/g, '<br>');
        this.dom.panelDescription.innerHTML = descriptionHtml;
        
        this.dom.panelImage.src = art.imageSrc;
        this.dom.panelImage.alt = art.imageAlt;

        // Gera o link do WhatsApp
        this.dom.panelWhatsapp.href = this.createWhatsAppLink(art);

        // Exibe o painel
        this.dom.detailPanel.classList.remove('hidden');
        setTimeout(() => {
            this.dom.detailPanel.classList.add('visible');
        }, 10); 

        this.isPanelOpen = true;

        // Libera o mouse (PointerLock) se estiver no desktop
        if (this.controlsManager) {
            this.controlsManager.unlockPointer();
        }
        
        this.dom.btnClosePanel.focus();

        if (this.isInTutorial && this.currentTutorialStep === 3) {
            this.endTutorial();
        }
    }

    /**
     * Fecha o painel de detalhes.
     */
    closeDetailPanel() {
        this.dom.detailPanel.classList.remove('visible');
        
        setTimeout(() => {
            this.dom.detailPanel.classList.add('hidden');
        }, 300); // 300ms (definido no CSS como --transition-speed)

        this.isPanelOpen = false;

        // Trava o mouse novamente se estiver no desktop
        if (this.controlsManager && !this.isMobile && !this.isInTutorial) {
            this.controlsManager.lockPointer();
        }
    }

    /**
     * Cria o link formatado para o WhatsApp.
     */
    createWhatsAppLink(art) {
        const imageUrl = art.whatsappImageUrl || window.location.href;
        const message = MESSAGE_TEMPLATE
            .replace('{title}', art.title)
            .replace('{imageUrl}', imageUrl);
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    }
}

// PONTO DE ENTRADA DA APLICAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
});