/* js/scene.js
  Este é o coração da experiência 3D.
  ⚠️ ALTERAÇÃO: Agora cria DOIS mundos: A Floresta e o Corredor.
*/

// Importa a biblioteca Three.js
const THREE = window.THREE; 

// Constante para a distância de interação
const INTERACTION_DISTANCE = 5.0; // (em metros)

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
        
        // Componentes principais
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Componentes de interação
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = INTERACTION_DISTANCE; 
        this.interactiveObjects = []; // Array para guardar objetos clicáveis

        // Componentes de áudio
        this.audioListener = null;
        this.sounds = {
            ambient: null,
            wind: null,
            creaks: []
        };
        
        // Estado
        this.isMuted = isMuted;

        // Utilitários
        this.clock = new THREE.Clock();
        
        // Carregadores
        this.textureLoader = new THREE.TextureLoader();
        this.audioLoader = new THREE.AudioLoader();
    }

    /**
     * Inicializa todos os componentes da cena.
     */
    async init() {
        try {
            // 1. Configura o renderizador
            this.setupRenderer();

            // 2. Cria a cena
            this.scene = new THREE.Scene();

            // 3. Configura a câmera
            this.setupCamera();

            // 4. Configura o ouvinte de áudio
            this.setupAudioListener();

            // 5. Adiciona luzes (PARA OS DOIS MUNDOS)
            this.setupWorldLights();

            // 6. Adiciona névoa
            this.setupFog();

            // 7. Carrega os sons
            // (Comentado para evitar erros 404 de MP3)
            // await this.loadSounds(); 

            // 8. ⚠️ CRIA OS DOIS MUNDOS ⚠️
            this.createForest(); // Mundo 1 (Início)
            this.createCorridor(); // Mundo 2 (Destino)

            // 9. Coloca as artes no corredor
            this.placeArtworks();

            // 10. Configura o 'resize'
            window.addEventListener('resize', () => this.onWindowResize());

            console.log('SceneManager inicializado com sucesso.');
        } catch (error) {
            console.error('Falha ao inicializar o SceneManager:', error);
            throw error;
        }
    }

    /** Configura o Renderizador WebGL */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setPixelRatio(window.devicePixelRatio); 
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        this.container.appendChild(this.renderer.domElement);
    }

    /** Configura a Câmera */
    setupCamera() {
        const fov = 75; 
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const near = 0.1;
        const far = 100;
        
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        
        // ⚠️ ALTERAÇÃO: Posição inicial agora é na FLORESTA
        // (x: 0 = centro, y: 1.6 = altura, z: 50 = início da floresta)
        this.camera.position.set(0, 1.6, 50);
    }
    
    /** Configura o 'Ouvinte' de Áudio */
    setupAudioListener() {
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
    }

    /** ⚠️ ALTERAÇÃO: Configura as Luzes de AMBOS os mundos */
    setupWorldLights() {
        // --- LUZES DA FLORESTA (Z=50) ---
        // Luz Ambiente (escura, azulada)
        const ambientLight = new THREE.AmbientLight(0x404080, 0.5); 
        this.scene.add(ambientLight);

        // Luz da "Lua" (forte, vindo de cima)
        const moonLight = new THREE.DirectionalLight(0xeeeeff, 0.8);
        moonLight.position.set(5, 10, 45); // Posicionada perto da floresta
        moonLight.castShadow = true;
        this.scene.add(moonLight);

        // --- LUZES DO CORREDOR (Z=0 a -70) ---
        // (Copiamas as luzes de vela que já tínhamos)
        const candleLightPositions = [
            [2, 1.8, 5], [-2, 1.8, 0], [2, 1.8, -5], [-2, 1.8, -10],
            [2, 1.8, -15], [-2, 1.8, -20], [2, 1.8, -25], [-2, 1.8, -30],
            [2, 1.8, -35], [-2, 1.8, -40], [2, 1.8, -45], [-2, 1.8, -50],
            [2, 1.8, -55], [-2, 1.8, -60], [2, 1.8, -65]
        ];
        
        const candleColor = 0xffaa40; // Cor quente
        const intensity = 2.0;
        const distance = 5; 
        const decay = 1.5;

        candleLightPositions.forEach(pos => {
            const pointLight = new THREE.PointLight(candleColor, intensity, distance, decay);
            pointLight.position.set(pos[0], pos[1], pos[2]);
            pointLight.castShadow = true;
            this.scene.add(pointLight);
            
            const flameGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const flameMat = new THREE.MeshBasicMaterial({ color: candleColor });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            pointLight.add(flame); 
        });
    }

    /** Configura a Névoa */
    setupFog() {
        const fogColor = 0x000000; 
        const near = 1;
        // ⚠️ ALTERAÇÃO: Névoa MUITO longa para cobrir os dois mundos
        const far = 80; 
        this.scene.fog = new THREE.Fog(fogColor, near, far);
        this.renderer.setClearColor(fogColor);
    }
    
    /** Carrega e configura os sons (Função Opcional) */
    async loadSounds() {
        // ... (código de carregar áudio) ...
    }

    /** ⚠️ NOVA FUNÇÃO: Cria a cena da Floresta (Mundo 1) */
    createForest() {
        // --- CHÃO DA FLORESTA ---
        // (Um grande plano verde escuro posicionado em Z=50)
        const floorGeo = new THREE.PlaneGeometry(40, 40); // 40m x 40m
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a }); // Verde escuro
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, 50); // Posiciona o chão na "área" da floresta
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // (Opcional: Adicionar "árvores" como cilindros marrons)
        // const treeGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
        // const treeMat = new THREE.MeshStandardMaterial({ color: 0x4a2a0a });
        // ... (código para posicionar várias árvores) ...

        // --- A PORTA GÓTICA PERDIDA ---
        // (Um plano simples que servirá de porta)
        const doorGeo = new THREE.PlaneGeometry(2, 3); // 2m largura, 3m altura
        // ⚠️ Carregue uma textura de porta gótica aqui
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x502020 }); // Marrom escuro/Vinho
        const door = new THREE.Mesh(doorGeo, doorMat);
        
        // Posição: (x=0, y=1.5 (metade da altura), z=35 (no fim da floresta))
        door.position.set(0, 1.5, 35); 
        
        // Adiciona dados para interação
        door.userData = {
            id: 'forest-door',
            type: 'door' // ⚠️ NOVO TIPO DE INTERAÇÃO
        };
        
        this.scene.add(door);
        
        // Adiciona a porta aos objetos interativos
        this.interactiveObjects.push(door);
    }

    /** Cria a geometria básica do corredor (Mundo 2) */
    createCorridor() {
        // (Esta função está 100% correta, construindo em z=0 a -80)
        // --- CHÃO ---
        const floorGeo = new THREE.PlaneGeometry(6, 80);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 }); 
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true; 
        this.scene.add(floor);

        // --- TETO ---
        const ceilingGeo = new THREE.PlaneGeometry(6, 80);
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 3.5;
        this.scene.add(ceiling);

        // --- PAREDES ---
        const wallGeo = new THREE.PlaneGeometry(80, 3.5);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        // Parede Esquerda
        const wallLeft = new THREE.Mesh(wallGeo, wallMat);
        wallLeft.rotation.y = Math.PI / 2;
        wallLeft.position.x = -3;
        wallLeft.position.y = 1.75;
        wallLeft.receiveShadow = true;
        this.scene.add(wallLeft);
        // Parede Direita
        const wallRight = new THREE.Mesh(wallGeo, wallMat);
        wallRight.rotation.y = -Math.PI / 2;
        wallRight.position.x = 3;
        wallRight.position.y = 1.75;
        wallRight.receiveShadow = true;
        this.scene.add(wallRight);
    }

    /** Posiciona as artes (quadros e placas) no corredor */
    placeArtworks() {
        // (Esta função está 100% correta)
        // Geometria padrão para os quadros (visuais)
        const frameGeo = new THREE.PlaneGeometry(1, 1.5); 
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 

        // Geometria da PLACA (Hitbox invisível)
        const plaqueGeo = new THREE.PlaneGeometry(1, 1.5); 
        const plaqueMat = new THREE.MeshStandardMaterial({ visible: false }); 

        this.artData.forEach((art, index) => {
            const isLeftSide = index % 2 === 0;
            const zPos = 8 - (index * 4); 

            // --- CRIA O QUADRO (VISUAL) ---
            const frameXPos = isLeftSide ? -2.9 : 2.9; 
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.set(frameXPos, 1.8, zPos); 
            frame.rotation.y = isLeftSide ? Math.PI / 2 : -Math.PI / 2;
            // ⚠️ Carregue a textura da arte aqui
            // const artTexture = this.textureLoader.load(art.imageSrc);
            // ...
            this.scene.add(frame);
            
            // --- CRIA A PLACA (HITBOX INVISÍVEL) ---
            const plaqueXPos = isLeftSide ? -2.89 : 2.89; 
            const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
            plaque.position.set(plaqueXPos, 1.8, zPos); 
            plaque.rotation.y = frame.rotation.y; 
            
            plaque.userData = {
                id: art.id,
                type: 'plaque' // TIPO "plaque"
            };
            
            this.scene.add(plaque);
            this.interactiveObjects.push(plaque);
        });
    }

    /** Loop de atualização/renderização */
    update(deltaTime) {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /** ⚠️ NOVA FUNÇÃO: Move a câmera instantaneamente */
    teleportCamera(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    /** Retorna o Delta Time (Corrigido) */
    getDeltaTime() {
        return this.clock.getDelta(); // Corrigido
    }

    /** Retorna a câmera (para os Controles) */
    getCamera() {
        return this.camera;
    }
    
    /** Encontra a placa mais próxima (para o Tutorial) */
    findNearestPlaque(cameraPosition) {
        let nearestPlaque = null;
        let minDistance = Infinity;
        const camPos = new THREE.Vector3().copy(cameraPosition);

        this.interactiveObjects.forEach(plaque => {
            // Apenas checa placas, não a porta
            if (plaque.userData.type === 'plaque') {
                const distance = camPos.distanceTo(plaque.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPlaque = plaque;
                }
            }
        });
        return (minDistance < 5) ? nearestPlaque : null;
    }

    /** Retorna o elemento DOM do renderizador (para os Controles) */
    getRendererDomElement() {
        return this.renderer.domElement;
    }

    /** Lida com o redimensionamento da janela. */
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    /** Gerencia o estado de Mudo dos sons. */
    setMute(isMuted) {
        this.isMuted = isMuted;
        if (this.isMuted) {
            this.audioListener.setMasterVolume(0);
        } else {
            this.audioListener.setMasterVolume(1);
            if (this.sounds.ambient && !this.sounds.ambient.isPlaying) {
                this.sounds.ambient.play();
            }
        }
    }
    
    /** Verifica interação com o Raycaster */
    checkInteraction(coords) {
        this.raycaster.setFromCamera(coords, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

        if (intersects.length > 0) {
            const firstHit = intersects[0];
            return firstHit.object.userData; 
        }
        return null;
    }
}