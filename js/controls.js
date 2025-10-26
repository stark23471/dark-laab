/* js/controls.js
  Este arquivo gerencia todo o movimento e interação do jogador.
  Ele lida com dois modos:
  1. Desktop: Teclas (WASD/Setas) + Mouse (PointerLock para olhar).
  2. Mobile: Joystick Virtual (esquerda) + Toque e Arraste (direita) para olhar.
  
  Ele NÃO usa o 'PointerLockControls' ou 'OrbitControls' do Three.js,
  pois precisamos de um controle estilo "FPS" (First-Person Shooter)
  que funcione no chão (sem voar) e integre com nosso joystick.
*/

// Importa o THREE para usar classes como Vector3 e Euler
const THREE = window.THREE;

export class ControlsManager {
    /**
     * @param {THREE.Camera} camera - A câmera da cena.
     * @param {HTMLElement} domElement - O elemento <canvas> do renderizador.
     * @param {boolean} isMobile - Se estamos em modo mobile.
     * @param {HTMLElement} joystickContainer - O container do joystick (para mobile).
     */
    constructor(camera, domElement, isMobile, joystickContainer) {
        this.camera = camera;
        this.domElement = domElement;
        this.isMobile = isMobile;
        
        // Elementos do Joystick
        this.joystickContainer = joystickContainer;
        this.joystickBase = joystickContainer.querySelector('#joystick-base');
        this.joystickHandle = joystickContainer.querySelector('#joystick-handle');
        
        // Estado de Movimento (controlado por teclas ou joystick)
        this.move = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // Estado de "Olhar" (controlado por mouse ou toque)
        this.look = {
            x: 0,
            y: 0
        };

        // Estado do Joystick (para mobile)
        this.joystick = {
            active: false,
            touchId: null, // ID do toque (para multitouch)
            origin: { x: 0, y: 0 }, // Posição inicial do toque
            current: { x: 0, y: 0 }, // Posição atual
            maxRadius: 50 // Raio máximo (metade do 'joystick-base' - 10px de margem)
        };
        
        // Estado do "Camera Drag" (para mobile)
        this.cameraDrag = {
            active: false,
            touchId: null,
            origin: { x: 0, y: 0 }
        };
        
        // Coordenadas do último clique/toque (para interação)
        this.lastTouchCoords = { x: 0, y: 0 };
        this.mouseCoords = { x: 0, y: 0 };

        // Variáveis de controle de câmera (FPS)
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Ordem 'YXZ' é crucial
        this.minPolarAngle = 0; // Ângulo mínimo (olhar para cima)
        this.maxPolarAngle = Math.PI; // Ângulo máximo (olhar para baixo)
        this.pointerSpeed = 1.0;
        this.isPointerLocked = false;
        
        // Físicas/Movimento
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 4.0; // 4 metros por segundo
        
        // Estado do Tutorial (para main.js)
        this.tutorialState = {
            hasMoved: false,
            hasLooked: false
        };

        // Bind 'this' para os métodos de evento
        // Isso garante que 'this' dentro da função se refira à classe.
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.init();
    }

    /** Inicializa os ouvintes de eventos corretos (Mobile vs Desktop) */
    init() {
        if (this.isMobile) {
            this.joystickContainer.classList.remove('hidden'); // Mostra o joystick
            this.domElement.addEventListener('touchstart', this.onTouchStart);
            this.domElement.addEventListener('touchmove', this.onTouchMove);
            this.domElement.addEventListener('touchend', this.onTouchEnd);
        } else {
            // Desktop
            document.addEventListener('keydown', this.onKeyDown);
            document.addEventListener('keyup', this.onKeyUp);
            document.addEventListener('mousemove', this.onMouseMove);
            
            // Pointer Lock (trava do mouse)
            document.addEventListener('pointerlockchange', this.onPointerLockChange);
            // Clicar na cena tenta travar o mouse
            this.domElement.addEventListener('click', () => {
                if (!this.isPointerLocked) {
                    this.domElement.requestPointerLock();
                }
            });
            // Clique do mouse (para interação)
            this.domElement.addEventListener('mousedown', this.onMouseDown);
        }
    }

    // --- MÉTODOS DE CONTROLE (DESKTOP) ---

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.move.forward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.move.left = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.move.backward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.move.right = true;
                break;
        }
        this.tutorialState.hasMoved = true;
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.move.forward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.move.left = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.move.backward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.move.right = false;
                break;
        }
    }

    onMouseMove(event) {
        // Guarda as coordenadas normalizadas do mouse (para raycasting de clique)
        this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Se o mouse não estiver travado, não faz nada (não move a câmera)
        if (!this.isPointerLocked) return;
        
        // 'movementX' e 'movementY' só funcionam com PointerLock
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        // Atualiza o 'Euler' (ângulo da câmera)
        // Isso é a lógica central do "mouse look"
        this.euler.setFromQuaternion(this.camera.quaternion);

        this.euler.y -= movementX * 0.002 * this.pointerSpeed;
        this.euler.x -= movementY * 0.002 * this.pointerSpeed;

        // 'Math.max' e 'Math.min' fazem o "clamp" (trava)
        // para impedir que o jogador vire a câmera de cabeça para baixo.
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

        // Aplica a nova rotação à câmera
        this.camera.quaternion.setFromEuler(this.euler);
        
        this.tutorialState.hasLooked = true;
    }
    
    onPointerLockChange() {
        if (document.pointerLockElement === this.domElement) {
            this.isPointerLocked = true;
        } else {
            this.isPointerLocked = false;
        }
    }
    
    // Usado para interação (clique) em desktop
    onMouseDown(event) {
        // Converte as coordenadas do clique para o formato do Raycaster
        this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // --- MÉTODOS DE CONTROLE (MOBILE) ---
    
    onTouchStart(event) {
        event.preventDefault(); // Impede o "pull-to-refresh"
        
        for (const touch of event.changedTouches) {
            // Pega a posição x,y do toque
            const touchX = touch.clientX;
            const touchY = touch.clientY;
            
            // Salva o último toque (para interação de "tap")
            this.lastTouchCoords.x = (touchX / window.innerWidth) * 2 - 1;
            this.lastTouchCoords.y = -(touchY / window.innerHeight) * 2 + 1;

            // Lado Esquerdo (Joystick)
            if (touchX < window.innerWidth / 2 && !this.joystick.active) {
                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;
                // Posiciona a base do joystick onde o dedo tocou
                this.joystickBase.style.left = `${touchX - 60}px`; // 60 = metade do tamanho da base
                this.joystickBase.style.top = `${touchY - 60}px`;
                this.joystickBase.style.display = 'flex';
                // Salva a origem
                this.joystick.origin.x = touchX;
                this.joystick.origin.y = touchY;
                // Reseta o 'handle'
                this.joystickHandle.style.transform = 'translate(0, 0)';
            
            // Lado Direito (Camera Drag)
            } else if (touchX >= window.innerWidth / 2 && !this.cameraDrag.active) {
                this.cameraDrag.active = true;
                this.cameraDrag.touchId = touch.identifier;
                this.cameraDrag.origin.x = touchX;
                this.cameraDrag.origin.y = touchY;
            }
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            // Se for o toque do Joystick...
            if (this.joystick.active && touch.identifier === this.joystick.touchId) {
                const deltaX = touch.clientX - this.joystick.origin.x;
                const deltaY = touch.clientY - this.joystick.origin.y;
                // Pitágoras para calcular a distância
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                // Ângulo
                const angle = Math.atan2(deltaY, deltaX);

                // Limita o movimento ao raio máximo
                const clampedDistance = Math.min(distance, this.joystick.maxRadius);
                const x = clampedDistance * Math.cos(angle);
                const y = clampedDistance * Math.sin(angle);
                
                // Move o "handle" (bolinha)
                this.joystickHandle.style.transform = `translate(${x}px, ${y}px)`;
                
                // Atualiza o estado de movimento (normalizado de -1 a 1)
                const moveX = x / this.joystick.maxRadius;
                const moveY = y / this.joystick.maxRadius;
                
                this.move.forward = moveY > 0.3;
                this.move.backward = moveY < -0.3;
                this.move.left = moveX < -0.3;
                this.move.right = moveX > 0.3;
                
                this.tutorialState.hasMoved = true;
            }
            
            // Se for o toque da Câmera...
            if (this.cameraDrag.active && touch.identifier === this.cameraDrag.touchId) {
                const deltaX = touch.clientX - this.cameraDrag.origin.x;
                const deltaY = touch.clientY - this.cameraDrag.origin.y;
                
                // Lógica de "olhar" (similar ao onMouseMove)
                this.euler.setFromQuaternion(this.camera.quaternion);
                this.euler.y -= deltaX * 0.005 * this.pointerSpeed; // 0.005 = sensibilidade mobile
                this.euler.x -= deltaY * 0.005 * this.pointerSpeed;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
                
                // Atualiza a origem para o próximo 'move'
                this.cameraDrag.origin.x = touch.clientX;
                this.cameraDrag.origin.y = touch.clientY;
                
                this.tutorialState.hasLooked = true;
            }
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            // Se o toque do Joystick terminou
            if (touch.identifier === this.joystick.touchId) {
                this.joystick.active = false;
                this.joystickBase.style.display = 'none'; // Esconde o joystick
                // Para todo o movimento
                this.move.forward = false;
                this.move.backward = false;
                this.move.left = false;
                this.move.right = false;
            }
            // Se o toque da Câmera terminou
            if (touch.identifier === this.cameraDrag.touchId) {
                this.cameraDrag.active = false;
            }
        }
    }

    // --- MÉTODOS DE ATUALIZAÇÃO (LOOP) ---

    /**
     * Atualiza a posição da câmera (chamado 60x por segundo pelo main.js).
     * @param {number} deltaTime - O tempo (em segundos) desde o último frame.
     */
    update(deltaTime) {
        // Ignora se o deltaTime for muito grande (ex: aba ficou inativa)
        if (deltaTime > 0.1) return; 

        // 1. Reseta a velocidade (eixo Y = gravidade, mas estamos sem gravidade)
        this.velocity.x = 0;
        this.velocity.z = 0;

        // 2. Calcula a direção baseada no input (tecla ou joystick)
        // 'this.direction' é um vetor que aponta para onde queremos ir
        this.direction.z = Number(this.move.forward) - Number(this.move.backward);
        this.direction.x = Number(this.move.left) - Number(this.move.right);
        this.direction.normalize(); // Garante que andar na diagonal não seja mais rápido

        // 3. Define a velocidade baseada na direção
        if (this.move.forward || this.move.backward) {
            this.velocity.z = this.direction.z * this.moveSpeed * deltaTime;
        }
        if (this.move.left || this.move.right) {
            this.velocity.x = this.direction.x * this.moveSpeed * deltaTime;
        }

        // 4. Move a câmera RELATIVO à direção que ela está olhando
        // 'translateX' move para os lados (baseado no X da câmera)
        // 'translateZ' move para frente/trás (baseado no Z da câmera)
        this.camera.translateX(this.velocity.x);
        this.camera.translateZ(this.velocity.z);
        
        // 5. COLISÃO (Simples)
        // Impede o jogador de sair das "paredes" do corredor (Largura 6m)
        if (this.camera.position.x < -2.5) {
            this.camera.position.x = -2.5;
        }
        if (this.camera.position.x > 2.5) {
            this.camera.position.x = 2.5;
        }
        // Impede de sair do comprimento do corredor (30m, de Z=10 a Z=-20)
        if (this.camera.position.z > 10.0) {
            this.camera.position.z = 10.0;
        }
        if (this.camera.position.z < -18.0) { // Um pouco antes do fim
            this.camera.position.z = -18.0;
        }
        
        // Trava a altura (Y) para não voar
        this.camera.position.y = 1.6;
    }

    // --- MÉTODOS PÚBLICOS (Helpers) ---

    lockPointer() {
        if (!this.isMobile) {
            this.domElement.requestPointerLock();
        }
    }

    unlockPointer() {
        if (!this.isMobile) {
            document.exitPointerLock();
        }
    }
    
    // Getters para o main.js
    isPointerLocked() {
        return this.isPointerLocked;
    }
    
    getLastTouchCoords() {
        return this.lastTouchCoords;
    }
    
    getMouseCoords() {
        return this.mouseCoords;
    }

    getCameraPosition() {
        return this.camera.position;
    }
    
    // Getters para o tutorial
    hasMoved() { return this.tutorialState.hasMoved; }
    hasLooked() { return this.tutorialState.hasLooked; }
}