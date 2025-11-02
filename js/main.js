/* js/main.js
  Este é o arquivo "maestro" (orquestrador) do site.
  ⚠️ ALTERAÇÃO: Adicionada lógica de Transição de Cena (Luz Ofuscante).
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
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.currentTutorialStep = 0;
        this.isInTutorial = false;
        this.isTransitioning = false; // ⚠️ NOVO: Impede duplo clique na porta

        // Seletores de DOM (elementos HTML)
        this.dom = {
            landingScreen: document.getElementById('landing-screen'),
            loadingScreen: document.getElementById('loading-screen'),
            mainExperience: document.getElementById('main-experience'),
            sceneContainer: document.getElementById('scene-container'),
            
            // ⚠️ ADICIONADO: Tela de transição (Luz Branca)
            transitionFade: document.getElementById('transition-fade'),

            // Botões
            btnEnter: document.getElementById('btn-enter'),
            btnTutorial: document.getElementById('btn-tutorial'),
            btnMute: document.getElementById('btn-mute'),
            btnClosePanel: document.getElementById('btn-close-panel'),
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
        
        // Botão de Ação (Mobile)
        if (this.isMobile && this.dom.actionButton) {
            this.dom.actionButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.tryToInteract(); 
            }, { passive: false });
        }

        // Teclado (Desktop)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPanelOpen) {
                this.closeDetailPanel();
            }
            if (e.key.toLowerCase() === 'e' && !this.isPanelOpen) {
                this.tryToInteract();
            }
        });

        // Clique do Mouse (Desktop)
        window.addEventListener('mousedown', (e) => {
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

        this.dom.landingScreen.style.opacity = 0;
        this.dom.loadingScreen.classList.remove('hidden');
        
        setTimeout(() => {
            this.dom.landingScreen.classList.add('hidden');
        }, 500); 

        try {
            await this.loadArtData();
            
            this.sceneManager = new SceneManager(this.dom.sceneContainer, this.artData, this.isMuted);
            await this.sceneManager.init();
            
            this.controlsManager = new ControlsManager(
                this.sceneManager.getCamera(), 
                this.sceneManager.getRendererDomElement(), 
                this.isMobile,
                this.dom.dpadContainer 
            );

            this.startRenderLoop();

            this.dom.loadingScreen.classList.add('hidden');
            this.dom.mainExperience.classList.remove('hidden');
            
            // CORREÇÃO: Força o resize
            if (this.sceneManager) {
                this.sceneManager.onWindowResize();
            }

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
        // (A lógica do tutorial começará na floresta)
        console.log('Iniciando tutorial...');
        this.currentTutorialStep = 1;
        this.showTutorialTooltip(
            this.isMobile 
            ? 'Use os botões para mover.'
            : 'Use WASD ou Setas para mover.'
        );
        // (O tutorial vai precisar de mais lógica para a porta)
    }

    updateTutorial() {
        // (Esta lógica precisará ser expandida para incluir a porta)
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
        // Impede interações se já estivermos no meio de uma transição
        if (this.isTransitioning) return; 
        
        if (!this.sceneManager || !this.controlsManager) return;

        let interactionTarget;
        
        if (!this.isMobile && isClick && !this.controlsManager.isPointerLocked()) {
            // Clique do mouse (Desktop, mouse destravado)
            const mouseCoords = this.controlsManager.getMouseCoords();
            interactionTarget = this.sceneManager.checkInteraction(mouseCoords);
        } else {
            // Tecla 'E', clique com mouse travado, ou botão ✋ (Mobile)
            // Todos usam a mira central ({x: 0, y: 0})
            interactionTarget = this.sceneManager.checkInteraction({ x: 0, y: 0 });
        }

        // ⚠️ LÓGICA DE INTERAÇÃO ATUALIZADA
        if (interactionTarget) {
            if (interactionTarget.type === 'plaque') {
                // Interação com o quadro de arte
                console.log('Interagindo com a placa:', interactionTarget.id);
                this.openDetailPanel(interactionTarget.id);
                
            } else if (interactionTarget.type === 'door') {
                // Interação com a porta da floresta
                console.log('Interagindo com a porta:', interactionTarget.id);
                this.transitionToCorridor(); // Chama a nova transição
            }
        }
    }
    
    /** ⚠️ NOVA FUNÇÃO: Transição da Floresta para o Corredor */
    transitionToCorridor() {
        // 1. Bloqueia novas interações
        this.isTransitioning = true;
        
        // 2. Fade para branco (Luz Ofuscante)
        this.dom.transitionFade.style.transition = "opacity 0.5s ease-in"; // Fade RÁPIDO para branco
        this.dom.transitionFade.classList.add('visible');
        
        // (Opcional: Tocar um som de porta abrindo)
        // this.sceneManager.playSound('door-creak');

        // 3. Espera a luz branca cobrir a tela
        setTimeout(() => {
            // 4. Move o jogador instantaneamente
            this.controlsManager.setZone('corridor'); // Muda as regras de colisão
            this.controlsManager.resetRotation(); // Reseta a câmera para olhar para frente
            this.sceneManager.teleportCamera(0, 1.6, 10); // Teletransporta o jogador

            // 5. Fade de volta (Olhos se acostumando)
            this.dom.transitionFade.style.transition = "opacity 1.5s ease-out"; // Fade LENTO de volta
            this.dom.transitionFade.classList.remove('visible');
            
            // 6. Libera as interações após o fade de volta
            setTimeout(() => {
                this.isTransitioning = false;
            }, 1500); // 1.5s (mesmo tempo do fade-out)

        }, 500); // 0.5s (mesmo tempo do fade-in)
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
        this.dom.panelWhatsapp.href = this.createWhatsAppLink(art);

        this.dom.detailPanel.classList.remove('hidden');
        setTimeout(() => {
            this.dom.detailPanel.classList.add('visible');
        }, 10); 

        this.isPanelOpen = true;

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
        }, 300); 

        this.isPanelOpen = false;

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