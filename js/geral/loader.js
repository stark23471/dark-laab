/*
    ARQUIVO: js/geral/loader.js
    DESCRIÇÃO: Gerenciador de Carregamento de Assets.
    
    ⚠️ ATUALIZADO: Lista de texturas da floresta usando a nova estrutura de pastas
    (asfalto, trilha, solo_terra_01, solo_terra_02) e fantasmas.
    
    COMENTÁRIOS EM: PT-BR
*/

class AssetLoader {
  constructor(onProgress, onLoad) {
    // ⚠️ CORRIGIDO: Usa o THREE global
    this.manager = new THREE.LoadingManager();

    this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = (itemsLoaded / itemsTotal) * 100;
      onProgress(progress);
      console.log(`Carregando: ${url} (${progress.toFixed(0)}%)`);
    };

    this.manager.onLoad = () => {
      onLoad();
      console.log("Todos os assets foram carregados.");
    };

    this.manager.onError = (url) => {
      console.warn(`Erro ao carregar o asset: ${url}. Usando cor sólida.`);
    };

    // ⚠️ CORRIGIDO: Usa o THREE global
    this.textureLoader = new THREE.TextureLoader(this.manager);
  }

  /**
   * Carrega a lista principal de texturas da Floresta.
   */
  loadScene1Textures() {
    
    // ⚠️ LISTA DE ASSETS ATUALIZADA (com base no seu 'image_b08821.png')
    const texturesToLoad = [
        // Chão (Rodovia)
        { name: 'asfalto_color', path: 'assets/floresta/asfalto/asfalto.color.png', repeat: [3, 10] },
        
        // Chão (Trilha)
        { name: 'trilha_color', path: 'assets/floresta/trilha/trilha_color.jpg', repeat: [2, 12] }, // (Assumindo trilha_color.jpg)

        // Chão (Floresta Longe - Z > 40)
        { name: 'solo_terra_02', path: 'assets/floresta/solo_terra_02/solo_terra_02.color.jpg', repeat: [50, 50] },

        // Chão (Floresta Perto - Z < 40)
        { name: 'solo_terra_01', path: 'assets/floresta/solo_terra_01/solo_terra_01.color.jpg', repeat: [50, 50] },
        
        // Objetos
        { name: 'porta', path: 'assets/porta.png' }, 
        { name: 'arvore', path: 'assets/arvore.png' },
        
        // Fantasmas (PNGs transparentes)
        { name: 'lady', path: 'assets/ghosts/lady.png' }, 
        { name: 'child', path: 'assets/ghosts/child.png' }
    ];
      
    const textures = {};
    texturesToLoad.forEach((tex) => {
      const texture = this.textureLoader.load(tex.path);
      if (tex.repeat) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(tex.repeat[0], tex.repeat[1]);
      }
      textures[tex.name] = texture;
    });

    return textures;
  }
}