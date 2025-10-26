/* js/scene.js
  Este é o coração da experiência 3D.
  Ele é responsável por:
  1. Configurar a cena, câmera e renderizador do Three.js.
  2. Carregar e posicionar luzes, névoa e objetos (corredor, quadros).
  3. Gerenciar o "Raycaster" (para detectar cliques/interações).
  4. Lidar com o áudio 3D posicional (sons do ambiente).
  5. Conter o loop de renderização (update).
*/

// Importa a biblioteca Three.js (necessário 'type="module"')
// Estamos assumindo que o 'three.min.js' carregado no HTML 
// disponibiliza 'THREE' globalmente.
// Se estivéssemos usando um bundler (Webpack, Vite), faríamos:
// import * as THREE from 'three';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const THREE = window.THREE; 

// Constante para a distância de interação
const INTERACTION_DISTANCE = 3.5; // (em metros)

export class SceneManager {
    /**
     * Construtor da cena.
     * @param {HTMLElement} container - A div onde o canvas 3D será renderizado.
     * @param {Array} artData - Os dados das artes (do arts.json).
     * @param {boolean} isMuted - O estado inicial de mudo.
     */
    constructor(container, artData, isMuted) {
        this.container = container;
        this.artData = artData;
        
        // Componentes principais do Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Componentes de interação
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = INTERACTION_DISTANCE; // Otimização: não checar além da distância
        this.interactiveObjects = []; // Array para guardar objetos clicáveis (placas)

        // Componentes de áudio
        this.audioListener = null;
        this.sounds = {
            ambient: null,
            wind: null,
            creaks: [] // Múltiplos sons de rangido
        };
        
        // Estado
        this.isMuted = isMuted;

        // Utilitários
        this.clock = new THREE.Clock(); // Para calcular o 'delta time'
        
        // Carregadores (Loaders)
        this.textureLoader = new THREE.TextureLoader();
        this.audioLoader = new THREE.AudioLoader();
        // this.gltfLoader = new GLTFLoader(); // Descomente se for carregar modelos .glb/gltf
    }

    /**
     * Inicializa todos os componentes da cena.
     * É uma função 'async' para poder usar 'await' ao carregar assets (texturas, sons).
     */
    async init() {
        try {
            // 1. Configura o renderizador (o que desenha a cena)
            this.setupRenderer();

            // 2. Cria a cena (o mundo)
            this.scene = new THREE.Scene();

            // 3. Configura a câmera (os "olhos" do jogador)
            this.setupCamera();

            // 4. Configura o ouvinte de áudio (os "ouvidos" do jogador)
            this.setupAudioListener();

            // 5. Adiciona luzes (ambiente + candelabros)
            this.setupLights();

            // 6. Adiciona névoa (para o clima 'Sleepy Hollow')
            this.setupFog();

            // 7. Carrega e configura os sons ambientes
            // ⚠️ Para evitar erros de 404 de MP3, mantenha esta linha comentada,
            // a menos que você tenha os arquivos de áudio em /assets/audio/
            // await this.loadSounds(); // 'await' espera os sons carregarem

            // 8. Cria o corredor (paredes, chão, teto)
            // (Usando geometria básica por enquanto)
            this.createCorridor();

            // 9. Coloca as artes e placas no corredor
            this.placeArtworks();

            // 10. (Opcional) Carrega modelos 3D complexos (mesas, candelabros)
            // await this.loadComplexModels(); // Descomentado como exemplo

            // 11. Configura o 'resize' (redimensionamento da tela)
            window.addEventListener('resize', () => this.onWindowResize());

            console.log('SceneManager inicializado com sucesso.');
        } catch (error) {
            console.error('Falha ao inicializar o SceneManager:', error);
            throw error; // Propaga o erro para o main.js
        }
    }

    /** Configura o Renderizador WebGL */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, // Suaviza as bordas (serrilhado)
            alpha: true // Permite fundo transparente (se necessário)
        });
        // Define a qualidade dos pixels
        this.renderer.setPixelRatio(window.devicePixelRatio); 
        // Define o tamanho inicial
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        // Habilita sombras (importante para o clima)
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras mais suaves
        
        // Adiciona o <canvas> ao HTML
        this.container.appendChild(this.renderer.domElement);
    }

    /** Configura a Câmera (PerspectiveCamera) */
    setupCamera() {
        const fov = 75; // Campo de visão (Field of View)
        const aspect = this.container.clientWidth / this.container.clientHeight; // Proporção
        const near = 0.1; // Plano de corte próximo
        const far = 100; // Plano de corte distante
        
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        
        // Posição inicial da câmera (início do corredor)
        // (x: 0 = centro, y: 1.6 = altura dos olhos, z: 10 = início do corredor)
        this.camera.position.set(0, 1.6, 10);
    }
    
    /** Configura o 'Ouvinte' de Áudio (preso à câmera) */
    setupAudioListener() {
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener); // O som "sai" da câmera
    }

    /** Configura as Luzes da Cena */
    setupLights() {
        // Luz Ambiente: Uma luz geral fraca, meio azulada (noite)
        const ambientLight = new THREE.AmbientLight(0x404080, 0.5); // Cor, Intensidade
        this.scene.add(ambientLight);

        // Luz da "Lua" (simulada): Uma luz direcional fraca
        const moonLight = new THREE.DirectionalLight(0x8080cc, 0.3);
        moonLight.position.set(5, 10, 5);
        this.scene.add(moonLight);

        // Luzes das Velas (PointLights)
        // Vamos adicionar algumas luzes pontuais ao longo do corredor
        // para simular candelabros.
        const candleLightPositions = [
            [2, 1.8, 5],
            [-2, 1.8, 0],
            [2, 1.8, -5]
        ];
        
        const candleColor = 0xffaa40; // Cor quente (laranja/amarelo)
        const intensity = 2.0;
        const distance = 5; // Alcance da luz
        const decay = 1.5; // Quão rápido a luz diminui

        candleLightPositions.forEach(pos => {
            const pointLight = new THREE.PointLight(candleColor, intensity, distance, decay);
            pointLight.position.set(pos[0], pos[1], pos[2]);
            
            // Habilita sombras para esta luz
            pointLight.castShadow = true;
            
            this.scene.add(pointLight);
            
            // (Opcional) Adicionar uma 'chama' visível
            const flameGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const flameMat = new THREE.MeshBasicMaterial({ color: candleColor });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            pointLight.add(flame); // Adiciona a chama como filha da luz
        });
    }

    /** Configura a Névoa */
    setupFog() {
        const fogColor = 0x000000; // Névoa preta (combina com o fundo)
        const near = 1; // Onde a névoa começa
        const far = 20; // Onde a névoa fica 100% densa
        this.scene.fog = new THREE.Fog(fogColor, near, far);
        // Também define a cor de "limpeza" do renderizador para a mesma da névoa
        this.renderer.setClearColor(fogColor);
    }
    
    /** Carrega e configura os sons */
    async loadSounds() {
        // Para carregar áudio, precisamos de uma 'promessa'
        const loadAudio = (url) => {
            return new Promise((resolve, reject) => {
                this.audioLoader.load(url, 
                    (buffer) => resolve(buffer), // Sucesso
                    undefined, // Progresso (ignorado)
                    (err) => reject(err) // Erro
                );
            });
        };

        try {
            // Carrega som ambiente (vento)
            const ambientBuffer = await loadAudio('assets/audio/wind.mp3');
            this.sounds.ambient = new THREE.Audio(this.audioListener);
            this.sounds.ambient.setBuffer(ambientBuffer);
            this.sounds.ambient.setLoop(true);
            this.sounds.ambient.setVolume(0.3);
            
            // Carrega som de rangido (para 'PositionalAudio')
            const creakBuffer = await loadAudio('assets/audio/floor-creak.mp3');
            
            // Cria vários "gatilhos" de rangido no chão
            const creakPositions = [[0, 0, 5], [1, 0, 0], [-1, 0, -5]];
            creakPositions.forEach(pos => {
                // PositionalAudio faz o som parecer vir de um local específico
                const creakSound = new THREE.PositionalAudio(this.audioListener);
                creakSound.setBuffer(creakBuffer);
                creakSound.setVolume(0.8);
                creakSound.setRefDistance(1); // Distância de referência
                
                // Cria um "gatilho" invisível no chão
                const triggerGeo = new THREE.BoxGeometry(1, 0.1, 1);
                const triggerMat = new THREE.MeshBasicMaterial({ visible: false });
                const triggerMesh = new THREE.Mesh(triggerGeo, triggerMat);
                triggerMesh.position.set(pos[0], pos[1], pos[2]);
                
                triggerMesh.add(creakSound); // Anexa o som ao gatilho
                this.scene.add(triggerMesh);
                this.sounds.creaks.push(creakSound);
            });
            
            // Inicia os sons (se não estiver mudo)
            this.setMute(this.isMuted);

        } catch (error) {
            console.warn('Não foi possível carregar os sons:', error);
        }
    }

    /** Cria a geometria básica do corredor */
    createCorridor() {
        // --- CHÃO ---
        // (Lembre-se: 'Y' é para cima)
        const floorGeo = new THREE.PlaneGeometry(6, 30); // Largura 6m, Comprimento 30m
        // ⚠️ Carregue sua textura aqui
        // const floorMat = new THREE.MeshStandardMaterial({ map: this.textureLoader.load('path/to/floor.jpg') });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Cor cinza escuro
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2; // Deita o plano no chão
        floor.position.y = 0;
        floor.receiveShadow = true; // Chão recebe sombras
        this.scene.add(floor);

        // --- TETO ---
        const ceilingGeo = new THREE.PlaneGeometry(6, 30);
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 3.5; // Altura do pé direito
        this.scene.add(ceiling);

        // --- PAREDES ---
        const wallGeo = new THREE.PlaneGeometry(30, 3.5); // Comprimento 30m, Altura 3.5m
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        // Parede Esquerda
        const wallLeft = new THREE.Mesh(wallGeo, wallMat);
        wallLeft.rotation.y = Math.PI / 2;
        wallLeft.position.x = -3; // Metade da largura do chão
        wallLeft.position.y = 1.75; // Metade da altura
        wallLeft.receiveShadow = true;
        this.scene.add(wallLeft);
        
        // Parede Direita
        const wallRight = new THREE.Mesh(wallGeo, wallMat);
        wallRight.rotation.y = -Math.PI / 2;
        wallRight.position.x = 3;
        wallRight.position.y = 1.75;
        wallRight.receiveShadow = true;
        this.scene.add(wallRight);
        
        // (Paredes de fundo/frente podem ser adicionadas se necessário)
    }

    /** Posiciona as artes (quadros e placas) no corredor */
    placeArtworks() {
        // Geometria e Material padrão para as placas (clicáveis)
        const plaqueGeo = new THREE.PlaneGeometry(0.5, 0.2); // 50cm x 20cm
        const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

        // Geometria e Material padrão para os quadros
        const frameGeo = new THREE.PlaneGeometry(1, 1.5); // 1m x 1.5m
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Moldura escura

        this.artData.forEach((art, index) => {
            // Alterna entre parede esquerda (-2.9) e direita (2.9)
            const isLeftSide = index % 2 === 0;
            const xPos = isLeftSide ? -2.9 : 2.9; // Posição X (levemente fora da parede)
            // Espaça os quadros ao longo do corredor (eixo Z)
            const zPos = 8 - (index * 4); // Começa em Z=8 e vai diminuindo

            // --- CRIA O QUADRO ---
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.set(xPos, 1.8, zPos); // Posição (x, y=altura, z)
            frame.rotation.y = isLeftSide ? Math.PI / 2 : -Math.PI / 2; // Vira para o corredor
            // ⚠️ Aqui você carregaria a textura da arte (art.imageSrc) no quadro
            // const artTexture = this.textureLoader.load(art.imageSrc);
            // const artMaterial = new THREE.MeshBasicMaterial({ map: artTexture });
            // ... (cria um plano para a arte e adiciona ao 'frame')
            this.scene.add(frame);
            
            // --- CRIA A PLACA (INTERATIVA) ---
            const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
            plaque.position.set(xPos, 0.9, zPos); // Posição (abaixo do quadro)
            plaque.rotation.y = frame.rotation.y; // Mesma rotação do quadro
            
            // ⭐️ IMPORTANTE: Adiciona dados customizados ao objeto
            // O Raycaster usará isso para identificar o que foi clicado.
            plaque.userData = {
                id: art.id,
                type: 'plaque'
            };
            
            // ⚠️ Adiciona um texto na placa (isso é avançado, usa CanvasTexture)
            // (Para simplificar, deixaremos a placa metálica vazia)
            
            this.scene.add(plaque);
            
            // Adiciona a placa ao array de objetos que o Raycaster deve checar
            this.interactiveObjects.push(plaque);
        });
    }

    /** * (Opcional) Carrega modelos 3D complexos (ex: .glb)
      * async loadComplexModels() {
      * try {
      * const gltf = await this.gltfLoader.loadAsync('assets/models/nightstand.glb');
      * const nightstand = gltf.scene;
      * * // Configura o modelo
      * nightstand.position.set(-2.5, 0, 2);
      * nightstand.scale.set(0.5, 0.5, 0.5);
      * nightstand.traverse((child) => {
      * if (child.isMesh) {
      * child.castShadow = true;
      * child.receiveShadow = true;
      * }
      * });
      * this.scene.add(nightstand);
      * * } catch (error) {
      * console.warn('Não foi possível carregar modelo 3D:', error);
      * }
      * }
    */

    /**
     * Loop de atualização/renderização (chamado pelo main.js).
     * @param {number} deltaTime - Tempo (em segundos) desde o último frame.
     */
    update(deltaTime) {
        // (Aqui entrariam animações, como a luz da vela piscando)
        
        // Renderiza a cena a partir da perspectiva da câmera
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /** Retorna o Delta Time (tempo desde o último frame) 
     * CORREÇÃO CRÍTICA APLICADA AQUI: .getDeltaTime() -> .getDelta()
     */
    getDeltaTime() {
        return this.clock.getDelta(); // <-- CORRIGIDO
    }

    /** Retorna a câmera (necessário para os Controles) */
    getCamera() {
        return this.camera;
    }
    
    /** Retorna a posição da câmera (para o Tutorial) */
    findNearestPlaque(cameraPosition) {
        let nearestPlaque = null;
        let minDistance = Infinity;
        
        const camPos = new THREE.Vector3().copy(cameraPosition);

        this.interactiveObjects.forEach(plaque => {
            const distance = camPos.distanceTo(plaque.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlaque = plaque;
            }
        });
        
        // Retorna a placa se estiver próxima o suficiente
        return (minDistance < 5) ? nearestPlaque : null;
    }

    /** Retorna o elemento DOM do renderizador (necessário para os Controles) */
    getRendererDomElement() {
        return this.renderer.domElement;
    }

    /**
     * Lida com o redimensionamento da janela do navegador.
     */
    onWindowResize() {
        // Atualiza as dimensões
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Atualiza o 'aspect ratio' (proporção) da câmera
        this.camera.aspect = width / height;
        // É OBRIGATÓRIO chamar isso após mudar o 'aspect'
        this.camera.updateProjectionMatrix();

        // Atualiza o tamanho do renderizador
        this.renderer.setSize(width, height);
    }
    
    /**
     * Gerencia o estado de Mudo dos sons.
     * @param {boolean} isMuted - O novo estado.
     */
    setMute(isMuted) {
        this.isMuted = isMuted;
        
        // O AudioListener gerencia o volume global
        if (this.isMuted) {
            this.audioListener.setMasterVolume(0);
        } else {
            this.audioListener.setMasterVolume(1);
            
            // Se os sons não estiverem tocando, inicia eles
            if (this.sounds.ambient && !this.sounds.ambient.isPlaying) {
                this.sounds.ambient.play();
            }
            // (Sons posicionais 'creaks' são tocados por gatilhos, não em loop)
        }
    }
    
    /**
     * Verifica se há um objeto interativo na mira do jogador.
     * @param {object} coords - Coordenadas normalizadas (x, y) de -1 a 1.
     * {x: 0, y: 0} é o centro da tela.
     * @returns {object|null} - O 'userData' do objeto atingido, ou nulo.
     */
    checkInteraction(coords) {
        // Atualiza o Raycaster para atirar um "raio"
        // a partir da câmera na direção das coordenadas.
        this.raycaster.setFromCamera(coords, this.camera);
        
        // Verifica quais objetos (da nossa lista) foram atingidos
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

        // Se atingiu algo...
        if (intersects.length > 0) {
            // Pega o primeiro objeto (o mais próximo)
            const firstHit = intersects[0];
            
            // Retorna os dados que guardamos em 'userData'
            return firstHit.object.userData;
        }

        // Não atingiu nada
        return null;
    }
}