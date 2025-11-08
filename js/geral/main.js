/*
    ARQUIVO: js/geral/main.js
    DESCRIÇÃO: Ponto de Entrada Principal da Aplicação (O "Maestro").
    
    ⚠️ CORRIGIDO: 
    - Remove 'import * as THREE' (agora usa o THREE global).
    - Remove a lógica do "Mundo 2" (Corredor),
      agora a porta apenas "termina" a demo.
    
    COMENTÁRIOS EM: PT-BR
*/

// ⚠️ REMOVIDO: 'import * as THREE from 'three';'
// A classe 'THREE' é carregada globalmente pelo script CDN no index.html

// Classe principal da aplicação
class SungApp {
    
    constructor() {
        // Elementos do DOM
        this.canvas = document.getElementById('game-canvas');
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingText = document.querySelector('.loading-text');
        this.transitionFade = document.getElementById('transition-fade');
        this.gameEndMessage = document.getElementById('game-end-message');
        this.uiElements = [
            document.getElementById('crosshair'),
            document.getElementById('logo'),
            document.getElementById('copyright')
        ];

        // Componentes do Three.js
        // ⚠️ CORRIGIDO: Usa o THREE global
        this.scene = new THREE.Scene(); 
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true 
        });
        this.clock = new THREE.Clock(); 

        // Componentes do Jogo
        this.loader = null;
        this.controls = null;
        this.interaction = null;
        
        // Construtor de Cena
        this.forestBuilder = null; // (Virá de CenaFloresta.js)
        this.world1_Group = null;
        
        this.triggerZones = [];

        // Estado do Jogo
        this.isLoaded = false;
        this.isTransitioning = false;
        
        this.highwayLoopCount = 0;
        this.ghostsTriggered = false;
        
        // Configurações (conforme UX finalizado)
        this.settings = {
            movementSpeed: 1.8,
            desktopCameraSpeed: 0.0008,
            mobileCameraSpeed: 0.0025,
            playerHeight: 1.6
        };
        
        this.animate = this.animate.bind(this);
    }

    // -----------------------------------------------------------------
    // INICIALIZAÇÃO
    // -----------------------------------------------------------------
    
    /**
     * Método principal de inicialização
     */
    init() {
        console.log("Iniciando SungApp (Modo Floresta)...");

        try {
            // 1. Configurar o Renderizador
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
            this.renderer.outputEncoding = THREE.sRGBEncoding;

            // 2. Configurar a Posição Inicial da Câmera
            this.camera.position.set(0, this.settings.playerHeight, 70); // Nasce na rodovia (Z=70)

            // 3. Inicializar o Loader de Assets (Texturas)
            this.loader = new AssetLoader(
                (progress) => {
                    this.loadingText.textContent = `Carregando... ${progress.toFixed(0)}%`;
                },
                () => {
                    this.startExperience(); // Chama o início quando tudo carregar
                }
            );

            // 4. Carrega as texturas da cena 1 (Floresta)
            const loadedTextures = this.loader.loadScene1Textures();
            
            // 5. Inicializar a "Fábrica" de Mundos
            this.forestBuilder = new ForestSceneBuilder(loadedTextures);

            // 6. Ouvinte de redimensionamento da janela
            window.addEventListener('resize', this.onWindowResize.bind(this));
        
        } catch (error) {
            console.error("Falha fatal na inicialização:", error);
            if (error.toString().includes("ForestSceneBuilder")) {
                console.error("ERRO: O arquivo 'js/floresta/cenaFloresta.js' não foi carregado. Verifique o <script> no index.html.");
            }
            this.loadingText.textContent = "Erro ao carregar. Verifique o console.";
            this.loadingText.style.color = "red";
        }
    }
    
    /**
     * Chamado quando o Loader termina (onLoad).
     */
    async startExperience() {
        console.log("Assets carregados. Iniciando a experiência.");
        
        // 1. Construir o Mundo 1 (Floresta)
        const world1Data = await this.forestBuilder.createWorld1(this.scene);
        this.world1_Group = world1Data.group;
        this.triggerZones = world1Data.triggerZones; 
        this.scene.add(this.world1_Group);

        // 2. Inicializar Controles
        this.controls = new PlayerControls(this.camera, this.canvas, this.settings);
        this.controls.setWorld(1, world1Data.collisionLimits);
        
        // 3. Inicializar Interação
        this.interaction = new InteractionHandler(
            this.camera, 
            this.scene, 
            this.handleInteraction.bind(this)
        );
        
        // 4. Conectar Controles e Interação
        this.controls.onInteract = () => {
            this.interaction.triggerInteraction();
        };

        // 5. Esconder a tela de Loading e mostrar a UI do Jogo
        this.loadingScreen.style.opacity = '0';
        setTimeout(() => {
            this.loadingScreen.style.display = 'none';
        }, 500); 

        this.uiElements.forEach(el => el.style.display = 'block');
        
        this.isLoaded = true;
        
        // 6. Iniciar o Loop de Animação
        this.animate();
    }
    
    // -----------------------------------------------------------------
    // LOOP DE ANIMAÇÃO (GAME LOOP)
    // -----------------------------------------------------------------

    /**
     * O Loop Principal (requestAnimationFrame).
     */
    animate() {
        requestAnimationFrame(this.animate);

        if (!this.isLoaded || this.isTransitioning) {
            return;
        }

        const delta = this.clock.getDelta();

        this.interaction.update();
        this.controls.update(delta);
        this.checkWorldTriggers();
        this.renderer.render(this.scene, this.camera);
    }
    
    /** Checa gatilhos de eventos (Loop, Fantasmas) */
    checkWorldTriggers() {
        if (!this.controls) return; 
        if (this.isTransitioning) return;

        const cameraPos = this.camera.position;

        for (const zone of this.triggerZones) {
            // (Cria uma "caixa" de colisão invisível para o gatilho)
            const box = new THREE.Box3().setFromObject(zone);
            
            if (box.containsPoint(cameraPos)) {
                const triggerType = zone.userData.type;
                
                if (triggerType === 'loop_trigger') {
                    // Teletransporta o jogador para o início da rodovia
                    this.camera.position.set(0, this.settings.playerHeight, 50); // (Início da trilha)
                    this.highwayLoopCount++;
                    console.log('Loop da rodovia:', this.highwayLoopCount);

                } else if (triggerType === 'ghost_trigger' && this.highwayLoopCount >= 2 && !this.ghostsTriggered) {
                    this.ghostsTriggered = true;
                    this.triggerGhostEvent();
                }
            }
        }
    }
    
    /** Dispara o evento dos fantasmas */
    triggerGhostEvent() {
        console.log('Disparando evento dos Fantasmas!');
        // ⚠️ Você precisa adicionar os sons: 'vamos-brincar.mp3' e 'entre-na-floresta.mp3'
        
        // Chama a animação de fade
        this.forestBuilder.showGhosts(); 
        
        setTimeout(() => {
             // (Toca o áudio "entre na floresta")
        }, 2000); 
    }


    // -----------------------------------------------------------------
    // LÓGICA DE INTERAÇÃO (FIM DE JOGO)
    // -----------------------------------------------------------------
    
    /**
     * Callback chamado pelo 'InteractionHandler'
     */
    handleInteraction(userData) {
        console.log("Interação disparada:", userData);
        
        // Verifica se é a porta gótica
        if (userData.type === 'gothic_door') {
            this.triggerGameEnd();
        }
    }

    /**
     * Executa o "Fim de Jogo" (Fade para Branco e mensagem)
     * (Esta é a sua transição de "luz ofuscante")
     */
    triggerGameEnd() {
        if (this.isTransitioning) return; 
        
        console.log("Fim da demo. Iniciando fade out...");
        this.isTransitioning = true; // Pausa o 'animate' loop

        // 1. Fade In Rápido (0.5s) para Branco
        this.transitionFade.style.transition = 'opacity 0.5s ease-in';
        this.transitionFade.style.opacity = '1';

        // 2. Mostra a mensagem "CONTINUA..."
        this.gameEndMessage.style.opacity = '1';

        // 3. Trava os controles
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        this.uiElements.forEach(el => el.style.display = 'none');
        document.getElementById('dpad-container').style.display = 'none';
        document.getElementById('action-btn').style.display = 'none';
        
        // ⚠️ REMOVIDO: Lógica de teletransporte para o corredor.
        // O jogo agora termina aqui.
    }

    // -----------------------------------------------------------------
    // UTILITÁRIOS
    // -----------------------------------------------------------------

    /**
     * Chamado quando a janela do navegador muda de tamanho.
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}

// -----------------------------------------------------------------
// PONTO DE ENTRADA
// -----------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
    if (window.location.protocol === 'file:') {
        console.error("ERRO: O projeto não pode ser executado localmente via 'file://'. Use um servidor local (veja como_rodar.txt).");
        document.body.innerHTML = '<div style="color: red; font-size: 20px; padding: 20px;">ERRO: O projeto não pode ser executado localmente. Por favor, use um servidor (veja o arquivo como_rodar.txt).</div>';
        return;
    }
    
    const app = new SungApp();
    app.init();
});