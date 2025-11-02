/* js/controls.js
  Este arquivo gerencia todo o movimento e interação do jogador.
  Lógica do Joystick foi SUBSTITUÍDA por um D-Pad estático.
  ⚠️ ALTERAÇÃO: Sensibilidade do TOQUE (Mobile) aumentada.
*/

// Importa o THREE para usar classes como Vector3 e Euler
const THREE = window.THREE;

export class ControlsManager {
    /**
     * @param {THREE.Camera} camera - A câmera da cena.
     * @param {HTMLElement} domElement - O elemento <canvas> do renderizador.
     * @param {boolean} isMobile - Se estamos em modo mobile.
     * @param {HTMLElement} dpadContainer - Recebe o container do D-Pad
     */
    constructor(camera, domElement, isMobile, dpadContainer) {
        this.camera = camera;
        this.domElement = domElement; // Este é o <canvas>
        this.isMobile = isMobile;
        
        // Seletores para os botões do D-Pad
        this.dom = {
            dpadUp: document.getElementById('dpad-up'),
            dpadDown: document.getElementById('dpad-down'),
            dpadLeft: document.getElementById('dpad-left'),
            dpadRight: document.getElementById('dpad-right')
        };
        
        // Estado de Movimento (controlado por teclas OU D-Pad)
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
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.minPolarAngle = 0;
        this.maxPolarAngle = Math.PI;
        this.isPointerLocked = false;
        
        // Físicas/Movimento
        this.velocity = new THREE.Vector3();
        
        // -----------------------------------------------------------------
        // ⚠️ VELOCIDADE DE MOVIMENTO (ANDAR) ⚠️
        this.moveSpeed = 1.8; // (em metros por segundo)
        // -----------------------------------------------------------------
        
        // Estado do Tutorial (para main.js)
        this.tutorialState = {
            hasMoved: false,
            hasLooked: false
        };

        // Bind 'this'
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
            // LÓGICA DO D-PAD
            const setupButton = (element, moveKey) => {
                if (!element) {
                    console.warn(`Elemento do D-Pad "${moveKey}" não encontrado.`);
                    return;
                }
                element.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.move[moveKey] = true;
                    this.tutorialState.hasMoved = true;
                }, { passive: false });
                element.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.move[moveKey] = false;
                });
            };
            setupButton(this.dom.dpadUp, 'forward');
            setupButton(this.dom.dpadDown, 'backward');
            setupButton(this.dom.dpadLeft, 'left');
            setupButton(this.dom.dpadRight, 'right');
            
            // LÓGICA DO "OLHAR" (CAMERA DRAG)
            this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
            this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
            this.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });

        } else {
            // Desktop
            document.addEventListener('keydown', this.onKeyDown);
            document.addEventListener('keyup', this.onKeyUp);
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('pointerlockchange', this.onPointerLockChange);
            this.domElement.addEventListener('click', () => {
                if (!this.isPointerLocked) {
                    this.domElement.requestPointerLock();
                }
            });
            this.domElement.addEventListener('mousedown', this.onMouseDown);
        }
    }

    // --- MÉTODOS DE CONTROLE (DESKTOP) ---
    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.move.forward = true; break;
            case 'ArrowLeft': case 'KeyA': this.move.left = true; break;
            case 'ArrowDown': case 'KeyS': this.move.backward = true; break;
            case 'ArrowRight': case 'KeyD': this.move.right = true; break;
        }
        this.tutorialState.hasMoved = true;
    }
    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.move.forward = false; break;
            case 'ArrowLeft': case 'KeyA': this.move.left = false; break;
            case 'ArrowDown': case 'KeyS': this.move.backward = false; break;
            case 'ArrowRight': case 'KeyD': this.move.right = false; break;
        }
    }
    onMouseMove(event) {
        this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
        if (!this.isPointerLocked) return;
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        this.euler.setFromQuaternion(this.camera.quaternion);

        // -----------------------------------------------------------------
        // ⚠️ SENSIBILIDADE DO MOUSE (DESKTOP) ⚠️
        this.euler.y -= movementX * 0.0008; 
        this.euler.x -= movementY * 0.0008;
        // -----------------------------------------------------------------

        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
        this.tutorialState.hasLooked = true;
    }
    onPointerLockChange() {
        this.isPointerLocked = (document.pointerLockElement === this.domElement);
    }
    onMouseDown(event) {
        this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // --- MÉTODOS DE CONTROLE (MOBILE) ---
    
    onTouchStart(event) {
        event.preventDefault(); 
        for (const touch of event.changedTouches) {
            const touchX = touch.clientX;
            const touchY = touch.clientY;
            this.lastTouchCoords.x = (touchX / window.innerWidth) * 2 - 1;
            this.lastTouchCoords.y = -(touchY / window.innerHeight) * 2 + 1;
            if (touchX >= (window.innerWidth / 2) && !this.cameraDrag.active) {
                this.cameraDrag.active = true;
                this.cameraDrag.touchId = touch.identifier;
                this.cameraDrag.origin.x = touchX;
                this.cameraDrag.origin.y = touchY;
                break;
            }
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
            if (this.cameraDrag.active && touch.identifier === this.cameraDrag.touchId) {
                const deltaX = touch.clientX - this.cameraDrag.origin.x;
                const deltaY = touch.clientY - this.cameraDrag.origin.y;
                
                this.euler.setFromQuaternion(this.camera.quaternion);

                // -----------------------------------------------------------------
                // ⚠️ SENSIBILIDADE DO TOQUE (MOBILE) ⚠️
                // (Valor anterior era 0.0015, aumentado para 0.0025)
                this.euler.y -= deltaX * 0.0025;
                this.euler.x -= deltaY * 0.0025;
                // -----------------------------------------------------------------
                
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
                
                this.cameraDrag.origin.x = touch.clientX;
                this.cameraDrag.origin.y = touch.clientY;
                this.tutorialState.hasLooked = true;
                break;
            }
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
            if (touch.identifier === this.cameraDrag.touchId) {
                this.cameraDrag.active = false;
                this.cameraDrag.touchId = null;
                break;
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

        // -----------------------------------------------------------------
        // ⚠️ LÓGICA DE MOVIMENTO (REESCRITA) ⚠️
        // Esta lógica não usa mais aceleração.
        // Ela calcula a distância exata a mover baseado na velocidade (1.8) e no deltaTime.
        
        // 1. Pega a direção do input (W=1, S=-1 / D=1, A=-1)
        let zDir = Number(this.move.forward) - Number(this.move.backward);
        let xDir = Number(this.move.right) - Number(this.move.left);

        // 2. Normaliza (para não andar mais rápido na diagonal)
        const directionVector = new THREE.Vector2(xDir, zDir);
        if (directionVector.length() > 0) {
             directionVector.normalize();
        }
       
        const speed = this.moveSpeed; // Pega o valor 1.8

        // 3. Calcula a distância a mover NESTE FRAME (Distância = Velocidade * Tempo)
        // (W/forward = zDir 1) (translateZ é negativo para ir para frente)
        const moveZ = -directionVector.y * speed * deltaTime;
        // (D/right = xDir 1) (translateX é positivo para ir para direita)
        const moveX = directionVector.x * speed * deltaTime;
        
        // 4. Move a câmera
        this.camera.translateX(moveX);
        this.camera.translateZ(moveZ);
        // -----------------------------------------------------------------

        
        // 5. COLISÃO (Simples)
        if (this.camera.position.x < -2.5) { this.camera.position.x = -2.5; }
        if (this.camera.position.x > 2.5) { this.camera.position.x = 2.5; }
        if (this.camera.position.z > 10.0) { this.camera.position.z = 10.0; }
        if (this.camera.position.z < -70.0) { this.camera.position.z = -70.0; } // Limite longo
        
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
    hasMoved() { return this.tutorialState.hasMoved; }
    hasLooked() { return this.tutorialState.hasLooked; }
}