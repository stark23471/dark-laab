/*
    ARQUIVO: js/geral/controls.js
    DESCRIÇÃO: Gerenciador de Controles do Jogador (Input Handler).
    
    ⚠️ ATUALIZADO: Lógica de colisão para a nova cena (Rodovia/Trilha).
    
    COMENTÁRIOS EM: PT-BR
*/

class PlayerControls {

    /**
     * @param {THREE.Camera} camera - A câmera do jogador.
     * @param {HTMLElement} domElement - O elemento canvas (para eventos).
     * @param {Object} settings - Configurações de velocidade e sensibilidade.
     */
    constructor(camera, domElement, settings) {
        this.camera = camera;
        this.domElement = domElement;
        this.settings = settings;

        this.onInteract = () => {}; 
        
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        this.cameraLook = {
            pitch: 0,
            yaw: 0
        };
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.currentWorld = 1;
        this.collisionLimits = null;
        
        this.isMobile = 'ontouchstart' in window;
        
        this.moveTouchId = null; 
        this.lookTouchId = null;
        this.lastLookPos = { x: 0, y: 0 };
        
        this.sensitivity = this.isMobile ? 
            this.settings.mobileCameraSpeed : 
            this.settings.desktopCameraSpeed;

        this.initListeners();
    }

    // -----------------------------------------------------------------
    // INICIALIZAÇÃO DOS OUVINTES DE EVENTO
    // -----------------------------------------------------------------
    initListeners() {
        if (this.isMobile) {
            this.initMobileControls();
        } else {
            this.initPointerLock();
            document.addEventListener('keydown', this.onKeyDown.bind(this));
            document.addEventListener('keyup', this.onKeyUp.bind(this));
        }
    }

    initPointerLock() {
        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.domElement) {
                document.addEventListener('mousemove', this.onMouseMove.bind(this));
            } else {
                document.removeEventListener('mousemove', this.onMouseMove.bind(this));
            }
        });
    }

    initMobileControls() {
        document.getElementById('dpad-container').style.display = 'grid';
        document.getElementById('action-btn').style.display = 'block';

        this.addTouchListener('dpad-forward', 'forward');
        this.addTouchListener('dpad-backward', 'backward');
        this.addTouchListener('dpad-left', 'left');
        this.addTouchListener('dpad-right', 'right');

        document.getElementById('action-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onInteract();
        });
        
        this.domElement.addEventListener('touchstart', this.onMobileTouchStart.bind(this), { passive: false });
        this.domElement.addEventListener('touchmove', this.onMobileTouchMove.bind(this), { passive: false });
        this.domElement.addEventListener('touchend', this.onMobileTouchEnd.bind(this), { passive: false });
    }

    addTouchListener(elementId, direction) {
        const element = document.getElementById(elementId);
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.moveState[direction] = true;
        });
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.moveState[direction] = false;
        });
    }

    // -----------------------------------------------------------------
    // HANDLERS DE EVENTO (MOVIMENTO / AÇÃO)
    // -----------------------------------------------------------------

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.moveState.forward = true; break;
            case 'ArrowLeft': case 'KeyA': this.moveState.left = true; break;
            case 'ArrowDown': case 'KeyS': this.moveState.backward = true; break;
            case 'ArrowRight': case 'KeyD': this.moveState.right = true; break;
            case 'KeyE': this.onInteract(); break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.moveState.forward = false; break;
            case 'ArrowLeft': case 'KeyA': this.moveState.left = false; break;
            case 'ArrowDown': case 'KeyS': this.moveState.backward = false; break;
            case 'ArrowRight': case 'KeyD': this.moveState.right = false; break;
        }
    }

    onMouseMove(event) {
        if (document.pointerLockElement !== this.domElement) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.cameraLook.yaw -= movementX * this.sensitivity;
        this.cameraLook.pitch -= movementY * this.sensitivity;
        this.cameraLook.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraLook.pitch));
        
        this.camera.rotation.set(this.cameraLook.pitch, this.cameraLook.yaw, 0, 'YXZ');
    }

    onMobileTouchStart(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
            if (touch.clientX > window.innerWidth / 2 && this.lookTouchId === null) {
                this.lookTouchId = touch.identifier;
                this.lastLookPos.x = touch.clientX;
                this.lastLookPos.y = touch.clientY;
            }
        }
    }

    onMobileTouchMove(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
            if (touch.identifier === this.lookTouchId) {
                const deltaX = touch.clientX - this.lastLookPos.x;
                const deltaY = touch.clientY - this.lastLookPos.y;

                this.lastLookPos.x = touch.clientX;
                this.lastLookPos.y = touch.clientY;

                this.cameraLook.yaw -= deltaX * this.sensitivity;
                this.cameraLook.pitch -= deltaY * this.sensitivity;
                this.cameraLook.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraLook.pitch));
                
                this.camera.rotation.set(this.cameraLook.pitch, this.cameraLook.yaw, 0, 'YXZ');
            }
        }
    }

    onMobileTouchEnd(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
            if (touch.identifier === this.lookTouchId) {
                this.lookTouchId = null;
            }
        }
    }


    // -----------------------------------------------------------------
    // ATUALIZAÇÃO (LOOP PRINCIPAL) E COLISÃO
    // -----------------------------------------------------------------

    setWorld(worldId, limits) {
        this.currentWorld = worldId;
        this.collisionLimits = limits;
    }
    
    resetRotation() {
        this.cameraLook.pitch = 0;
        this.cameraLook.yaw = 0;
        this.camera.rotation.set(0, 0, 0, 'YXZ');
    }

    update(delta) {
        const moveSpeed = this.settings.movementSpeed * delta;

        this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
        this.direction.x = Number(this.moveState.left) - Number(this.moveState.right);
        this.direction.normalize(); 

        const oldPosition = this.camera.position.clone();

        if (this.moveState.forward || this.moveState.backward) {
            this.camera.translateZ(-this.direction.z * moveSpeed);
        }
        if (this.moveState.left || this.moveState.right) {
            this.camera.translateX(-this.direction.x * moveSpeed);
        }

        if (this.collisionLimits) {
            this.applyCollisions(oldPosition);
        }
        
        this.camera.position.y = this.settings.playerHeight;
    }

    /**
     * ⚠️ LÓGICA DE COLISÃO ATUALIZADA (BASEADA NA CENA DA RODOVIA)
     */
    applyCollisions(oldPosition) {
        const newPosition = this.camera.position;
        const limits = this.collisionLimits;
            
        const camX = newPosition.x;
        const camZ = newPosition.z;

        // 1. Limites da Rodovia (Z > 40)
        if (camZ > 40) {
            // Limita a largura da rodovia (10m, de x=-5 a x=5)
            newPosition.x = Math.max(limits.minX, Math.min(limits.maxX, camX)); 
            // Limite "para trás" (z=78, antes do gatilho de loop)
            newPosition.z = Math.min(limits.maxZ, camZ); 
        } 
        // 2. Limites da Grama/Trilha (Z < 40)
        else {
            // Regra de entrada: Só pode entrar na trilha (x entre -1.5 e 1.5)
            if (camX > -1.5 && camX < 1.5) { 
                // Permite que ande até a porta (Z=20.5)
                newPosition.z = Math.max(limits.minZ, camZ); 
            } else {
                // Bate na "parede invisível" da floresta (X=-5 ou X=5)
                // E é empurrado de volta para a rodovia
                newPosition.z = 40;
            }
        }
        
        // Aplica a posição corrigida
        this.camera.position.copy(newPosition);
    }
}