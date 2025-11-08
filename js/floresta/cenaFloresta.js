/*
    ARQUIVO: js/floresta/cenaFloresta.js
    DESCRIÇÃO: Construtor de Cenário 3D - MUNDO 1 (FLORESTA).
    
    ⚠️ CORRIGIDO: Removidos 'import' para parar o SyntaxError.
    Usa o GLTFLoader global (carregado no index.html).
    
    COMENTÁRIOS EM: PT-BR
*/

// ⚠️ REMOVIDO: 'import * as THREE from 'three';'
// ⚠️ REMOVIDO: 'import { GLTFLoader } from ...'
// (O THREE agora é global, vindo do index.html)

class ForestSceneBuilder {
  constructor(textures) {
    this.textures = textures;
    
    // ⚠️ CORRIGIDO: Usa o GLTFLoader global que o index.html carregou
    // (THREE.GLTFLoader agora existe)
    this.gltfLoader = new THREE.GLTFLoader(); 
    
    this.ghosts = {
        lady: null,
        child: null
    };
  }

  // -----------------------------------------------------------------
  // CENA 1: A DESCOBERTA (MUNDO ABERTO / FLORESTA)
  // -----------------------------------------------------------------
  
  async createWorld1(scene) {
    const world1Group = new THREE.Group();
    world1Group.name = "World1_Group";

    // 1. Configuração do Clima (Névoa e Luz)
    const fogColor = 0x4a5a6a; // Cinza-azulado (clima.png)
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.Fog(fogColor, 1, 50); // Névoa densa

    const ambientLight = new THREE.AmbientLight(0x4a5a6a, 0.5);
    world1Group.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xb5c0d6, 0.6);
    directionalLight.position.set(5, 10, 55);
    world1Group.add(directionalLight);

    // 2. Geometria do Chão
    
    // Chão da Floresta (Perto, Z < 40) - solo_terra_01
    const forestFloorMat1 = new THREE.MeshStandardMaterial({
      map: this.textures.solo_terra_01,
      color: 0x333333 
    });
    const forestFloorGeo1 = new THREE.PlaneGeometry(200, 80); 
    const forestFloor1 = new THREE.Mesh(forestFloorGeo1, forestFloorMat1);
    forestFloor1.rotation.x = -Math.PI / 2;
    forestFloor1.position.set(0, -0.02, 0); 
    world1Group.add(forestFloor1);

    // Chão da Floresta (Longe, Z > 40) - solo_terra_02
    const forestFloorMat2 = new THREE.MeshStandardMaterial({
      map: this.textures.solo_terra_02,
      color: 0x444444 
    });
    const forestFloorGeo2 = new THREE.PlaneGeometry(200, 80); 
    const forestFloor2 = new THREE.Mesh(forestFloorGeo2, forestFloorMat2);
    forestFloor2.rotation.x = -Math.PI / 2;
    forestFloor2.position.set(0, -0.01, 80); 
    world1Group.add(forestFloor2);

    // Rodovia (Asfalto) - PONTO DE INÍCIO
    const roadMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.asfalto_color,
      color: 0x333333
    });
    const roadGeometry = new THREE.PlaneGeometry(10, 40); 
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, 60); // (Z=40 a Z=80)
    world1Group.add(road);

    // Trilha de Terra (levando à porta)
    const pathMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.trilha_color,
      color: 0x504030 
    });
    const pathGeometry = new THREE.PlaneGeometry(3, 20); 
    const path = new THREE.Mesh(pathGeometry, pathMaterial);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 30); // (Z=20 a Z=40)
    world1Group.add(path);
    
    // 3. Floresta Densa (Árvores e Paredes Invisíveis)
    const treeMaterial = new THREE.SpriteMaterial({
      map: this.textures.arvore,
      transparent: true,
      alphaTest: 0.5,
      fog: true,
      color: 0xaaaaaa, 
    });

    const treeGeo = new THREE.PlaneGeometry(4, 8); 
    for (let i = 0; i < 80; i++) {
        const tree = new THREE.Sprite(treeMaterial); 
        let x = (Math.random() - 0.5) * 50; 
        if (x > -3 && x < 3) { 
            x += (x > 0) ? 3 : -3;
        }
        const z = (Math.random() * 40) + 10; 
        
        if (x > -6 && x < 6 && z > 39) {
            continue;
        }
        
        tree.position.set(x, 4, z); 
        world1Group.add(tree);
    }
    
    const wallMat = new THREE.MeshBasicMaterial({ visible: false });
    const wallLeftGeo = new THREE.PlaneGeometry(30, 10);
    const wallLeft = new THREE.Mesh(wallLeftGeo, wallMat);
    wallLeft.rotation.y = Math.PI / 2;
    wallLeft.position.set(-5, 5, 25); 
    world1Group.add(wallLeft);
    
    const wallRight = wallLeft.clone();
    wallRight.rotation.y = -Math.PI / 2;
    wallRight.position.set(5, 5, 25); 
    world1Group.add(wallRight);

    // 4. A Porta Gótica (Objetivo)
    const doorFrameGeo = new THREE.BoxGeometry(4, 5, 0.5);
    const doorFrameMat = new THREE.MeshStandardMaterial({ 
        map: this.textures.porta, 
        color: 0xaaaaaa 
    }); 
    const frame = new THREE.Mesh(doorFrameGeo, doorFrameMat);
    frame.position.set(0, 2.5, 20); // (Z=20)
    world1Group.add(frame);
    
    // Hitbox da Porta
    const hitboxGeo = new THREE.BoxGeometry(4, 3, 1);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.set(0, 1.5, 20); 
    hitbox.userData = {
      interactive: true,
      type: "gothic_door", 
    };
    world1Group.add(hitbox);

    // 5. ⚠️ NOVO: Carro Vermelho (GLB)
    try {
        // ⚠️ Você DEVE baixar um .glb de carro e salvar como 'car.glb'
        // em 'assets/models/car.glb'
        const gltf = await this.gltfLoader.loadAsync('assets/models/car.glb');
        const carModel = gltf.scene;
        carModel.scale.set(1.5, 1.5, 1.5);
        carModel.position.set(3, 0.5, 65); // Acostamento (X=3, Z=65)
        carModel.rotation.y = Math.PI / 1.5;
        
        // Farol 1
        const headlight1 = new THREE.SpotLight(0xffffff, 50, 30, Math.PI / 6, 0.5, 2);
        headlight1.position.set(-0.8, 0.5, 1.8); 
        carModel.add(headlight1);
        headlight1.target.position.set(-0.8, 0.3, -20); 
        carModel.add(headlight1.target);

        // Farol 2
        const headlight2 = headlight1.clone();
        headlight2.position.set(0.8, 0.5, 1.8);
        carModel.add(headlight2);
        headlight2.target.position.set(0.8, 0.3, -20); 
        carModel.add(headlight2.target);

        world1Group.add(carModel);

    } catch(e) {
        console.warn("Não foi possível carregar 'assets/models/car.glb'. Criando placeholder.", e);
        const carPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({color: 0xff0000}));
        carPlaceholder.position.set(3, 0.5, 65);
        world1Group.add(carPlaceholder);
    }
    
    // 6. ⚠️ NOVO: Fantasmas (Billboards, inicialmente invisíveis)
    const ladyTexture = this.textures.lady; 
    const childTexture = this.textures.child;
    const ghostMat = (tex) => new THREE.MeshBasicMaterial({
        map: tex, transparent: true, alphaTest: 0.1, opacity: 0, fog: false
    });

    this.ghosts.lady = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.5), ghostMat(ladyTexture));
    this.ghosts.lady.position.set(1.5, 1.25, 50); // Perto da trilha
    world1Group.add(this.ghosts.lady);
    
    this.ghosts.child = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), ghostMat(childTexture));
    this.ghosts.child.position.set(0.5, 0.75, 50); // Perto da trilha
    world1Group.add(this.ghosts.child);

    // 7. ⚠️ NOVO: Gatilhos de Zona (Loop e Fantasmas)
    const triggerZones = [];
    const triggerMat = new THREE.MeshBasicMaterial({ visible: false });
    
    // Gatilho de Loop (no fim da rodovia, Z=79)
    const loopTriggerGeo = new THREE.BoxGeometry(10, 5, 1);
    const loopTrigger = new THREE.Mesh(loopTriggerGeo, triggerMat);
    loopTrigger.position.set(0, 2.5, 79); 
    loopTrigger.userData = { type: 'loop_trigger' };
    triggerZones.push(loopTrigger);
    
    // Gatilho dos Fantasmas (no meio da rodovia, Z=60)
    const ghostTriggerGeo = new THREE.BoxGeometry(10, 5, 1);
    const ghostTrigger = new THREE.Mesh(ghostTriggerGeo, triggerMat);
    ghostTrigger.position.set(0, 2.5, 60);
    ghostTrigger.userData = { type: 'ghost_trigger' };
    triggerZones.push(ghostTrigger);
    
    world1Group.add(loopTrigger, ghostTrigger);

    // 8. Limites de Colisão
    const worldLimits = {
      minX: -4.5, // Largura da rodovia/trilha
      maxX: 4.5,
      minZ: 20.5, // Fim da trilha (porta)
      maxZ: 78,   // Antes do gatilho de loop
    };

    return { group: world1Group, collisionLimits: worldLimits, triggerZones: triggerZones };
  }
  
  /** ⚠️ NOVA FUNÇÃO: Animação dos Fantasmas */
  showGhosts() {
    if (this.ghosts.lady && this.ghosts.child) {
        console.log("Mostrando fantasmas...");
        // Fade in
        this.ghosts.lady.material.opacity = 1;
        this.ghosts.child.material.opacity = 1;

        // Fade out
        setTimeout(() => {
            console.log("Escondendo fantasmas...");
            this.ghosts.lady.material.opacity = 0;
            this.ghosts.child.material.opacity = 0;
        }, 4000); // 4 segundos visível
    }
  }
}