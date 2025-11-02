/* js/controls.js
  Este arquivo gerencia todo o movimento e interação do jogador.
  ⚠️ ALTERAÇÃO: Adicionada lógica de "Zonas" (Floresta e Corredor)
  para colisão e teletransporte.
*/

// Importa o THREE para usar classes como Vector3 e Euler
const THREE = window.THREE;

export class ControlsManager {
    /**
     * @param {THREE.Camera} camera - A câmera da cena.
     * @param {HTMLElement} domElement - O elemento <canvas> do renderizador.
     *_@param {boolean} isMobile - Se estamos em modo mobile.
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
        
        // Estado de Movimento
        this.move = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // Estado do "Camera Drag"
        this.cameraDrag = {
            active: false,
            touchId: null,
            origin: { x: 0, y: 0 }
        };
        
        this.lastTouchCoords = { x: 0, y: 0 };
        this.mouseCoords = { x: 0, y: 0 };

        // Variáveis de controle de câmera
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.minPolarAngle = 0;
        this.maxPolarAngle = Math.PI;
        this.isPointerLocked = false;
        
        // Físicas/Movimento
        this.moveSpeed = 1.8; // Velocidade de caminhada lenta
        
        // ⚠️ NOVO: Estado de Zona (começa na floresta)
        this.currentZone = 'forest';
        
        // Estado do Tutorial
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

        this.euler.y -= movementX * 0.0008; // Sensibilidade Desktop X
        this.euler.x -= movementY * 0.0008; // Sensibilidade Desktop Y

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

                this.euler.y -= deltaX * 0.0025; // Sensibilidade Mobile X
                this.euler.x -= deltaY * 0.0025; // Sensibilidade Mobile Y
                
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

    update(deltaTime) {
        if (deltaTime > 0.1) return; 

        // LÓGICA DE MOVIMENTO (Velocidade Constante)
        let zDir = Number(this.move.forward) - Number(this.move.backward);
        let xDir = Number(this.move.right) - Number(this.move.left);
        const directionVector = new THREE.Vector2(xDir, zDir);
        if (directionVector.length() > 0) {
             directionVector.normalize();
        }
        const speed = this.moveSpeed; 
        const moveZ = -directionVector.y * speed * deltaTime;
        const moveX = directionVector.x * speed * deltaTime;
        
        this.camera.translateX(moveX);
        this.camera.translateZ(moveZ);
        
        // -----------------------------------------------------------------
        // ⚠️ NOVA LÓGICA DE COLISÃO (BASEADA EM ZONA) ⚠️
        // -----------------------------------------------------------------
        
        if (this.currentZone === 'forest') {
            // Limites da Floresta (Chão de 40x40, Porta em z=35)
            if (this.camera.position.x < -19.5) { this.camera.position.x = -19.5; }
            if (this.camera.position.x > 19.5) { this.camera.position.x = 19.5; }
            // Não pode ir para "trás" da porta (z=35)
            if (this.camera.position.z < 35.5) { this.camera.position.z = 35.5; } 
            // Não pode ir para trás do início (z=50 + 10 de margem)
            if (this.camera.position.z > 60.0) { this.camera.position.z = 60.0; }

        } else { // 'corridor'
            // Limites do Corredor (Chão de 6m de largura)
            if (this.camera.position.x < -2.5) { this.camera.position.x = -2.5; }
            if (this.camera.position.x > 2.5) { this.camera.position.x = 2.5; }
            // Não pode voltar para a floresta (z=10)
            if (this.camera.position.z > 10.0) { this.camera.position.z = 10.0; }
            // Limite do fim do corredor
            if (this.camera.position.z < -70.0) { this.camera.position.z = -70.0; } 
        }
        
        // Trava a altura (Y) para não voar
        this.camera.position.y = 1.6;
    }

    // --- MÉTODOS PÚBLICOS (Helpers) ---

    /** ⚠️ NOVA FUNÇÃO: Define a zona de colisão atual */
    setZone(zoneName) {
        this.currentZone = zoneName;
    }

    /** ⚠️ NOVA FUNÇÃO: Reseta a rotação da câmera após teletransporte */
    resetRotation() {
        // Reseta a câmera para olhar para frente (Z negativo)
        this.camera.rotation.set(0, 0, 0); 
        // Reseta o cálculo interno do 'euler'
        this.euler.set(0, 0, 0, 'YXZ');
        // Aplica essa rotação resetada
        this.camera.quaternion.setFromEuler(this.euler);
    }

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