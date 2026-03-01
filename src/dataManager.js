import { db, auth } from './firebase-config.js';
import { ref, set, onValue, update, push, query, limitToLast, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getItem } from './data/items.js';
import { Storage } from './core/storage.js';

/**
 * DataManager
 * 
 * Responsible for:
 * 1. User Identity (localStorage userId)
 * 2. Data Loading & Legacy Migration
 * 3. Data Saving (StateBuffer Dirty Checking & Optimistic Locking)
 * 4. Offline Recovery Queue
 * 5. Real-time Sync with Firebase
 */
export default class DataManager {
    constructor() {
        if (DataManager.instance) {
            return DataManager.instance;
        }

        this.userId = this._getOrInitUserId();
        this.data = null;
        this.previousState = null; // [New] StateBuffer
        this.offlineQueue = JSON.parse(localStorage.getItem('rpg_offlineQueue') || '[]');

        this.defaultData = {
            money: 0,
            position: { x: 300, y: 300, mapId: 'town' },
            inventory: [],
            activePetId: null,
            completedQuests: [],
            stats: { fishing: 1, farming: 1, hunting: 1 },
            housing: { furniture: [] },
            lastLogin: Date.now()
        };

        this.others = {};
        this.worldItems = {};

        // Throttling state for position updates
        this.lastPositionUpdate = 0;
        this.positionUpdateInterval = 200; // 200ms
        this.pendingPosition = null;
        this.positionTimer = null;

        // [New] Setup online listener for offline queue recovery
        window.addEventListener('online', () => this._processOfflineQueue());

        DataManager.instance = this;
    }

    /**
     * Retrieves existing userId from localStorage or generates a new one.
     * @returns {string} userId
     */
    _getOrInitUserId() {
        let id = localStorage.getItem('rpg_userId');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('rpg_userId', id);
            console.log(`[DataManager] New User ID generated: ${id}`);
        } else {
            console.log(`[DataManager] User ID loaded: ${id}`);
        }
        return id;
    }

    /**
     * Firebase Anonymous Auth 브릿지.
     * 성공 시 Firebase UID로 교체, 실패 시 기존 localStorage ID 유지.
     * @returns {Promise<string>} Firebase UID or fallback localStorage ID
     */
    async initFirebaseAuth() {
        try {
            if (!auth) {
                console.warn('[DataManager] Firebase Auth not available, using localStorage ID');
                return this.userId;
            }
            const cred = await signInAnonymously(auth);
            const firebaseUid = cred.user.uid;

            // 기존 localStorage ID와 다르면 데이터 마이그레이션 필요 표시
            const oldId = this.userId;
            if (oldId !== firebaseUid) {
                console.log(`[DataManager] Firebase Auth UID: ${firebaseUid} (was localStorage: ${oldId})`);
                // 데이터 경로를 Firebase UID로 통일
                this.userId = firebaseUid;
                localStorage.setItem('rpg_userId', firebaseUid);
            }
            return firebaseUid;
        } catch (e) {
            console.warn('[DataManager] Firebase Auth failed, using localStorage ID:', e.message);
            return this.userId;
        }
    }

    /**
     * Deep merges source object into target object immutably.
     * @param {Object} target 
     * @param {Object} source 
     * @returns {Object} A new merged object
     */
    _deepMerge(target, source) {
        if (source === null || typeof source !== 'object') {
            return source;
        }

        if (Array.isArray(source)) {
            return [...source];
        }

        const merged = { ...target };
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    merged[key] = this._deepMerge(merged[key] || {}, source[key]);
                } else {
                    merged[key] = source[key];
                }
            }
        }
        return merged;
    }

    /**
     * Compares new state with old state and returns only the fields that changed (Delta).
     */
    _getDirtyValues(oldState, newState) {
        if (!oldState) return { ...newState };
        const dirty = {};
        for (const key in newState) {
            if (Object.prototype.hasOwnProperty.call(newState, key)) {
                if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
                    dirty[key] = newState[key];
                }
            }
        }
        return dirty;
    }

    /**
     * Loads user data from Firebase, merges with default structure, and handles legacy migration.
     * @returns {Promise<Object>} The fully loaded and merged data.
     */
    loadData() {
        return new Promise((resolve) => {
            const userRef = ref(db, 'users/' + this.userId);

            onValue(userRef, (snapshot) => {
                const remoteData = snapshot.val();

                if (remoteData) {
                    console.log('[DataManager] Data found on server.');

                    // Optimistic Locking: Ignore local cache if server is newer
                    if (this.data && remoteData.lastUpdated && this.data.lastUpdated && remoteData.lastUpdated > this.data.lastUpdated) {
                        console.warn('[DataManager] Server data is newer. Force Syncing.');
                    }

                    this.data = this._deepMerge(this.defaultData, remoteData);
                    this.previousState = JSON.parse(JSON.stringify(this.data));
                } else {
                    console.log('[DataManager] Checking for Legacy local data...');
                    const legacyData = Storage.load(); // Temp migration usage

                    if (legacyData) {
                        console.log('[DataManager] Legacy data found. Migrating to Firebase...');
                        this.data = this._deepMerge(this.defaultData, legacyData);
                        this.saveUserData(this.data).then(() => {
                            console.log('[DataManager] Migration Complete.');
                        });
                    } else {
                        console.log('[DataManager] New user. Using default data.');
                        this.data = this._deepMerge({}, this.defaultData);
                        this.saveUserData(this.data);
                    }
                    this.previousState = JSON.parse(JSON.stringify(this.data));
                }

                // Update last login
                this.saveUserData({ lastLogin: Date.now() });

                resolve(this.data);
            }, { onlyOnce: true });
        });
    }

    /**
     * Generic save function for partial updates utilizing StateBuffer dirty checking.
     * @param {Object} partialData - State updates to apply.
     * @returns {Promise} Resolves on success, rejects on failure (for rollback).
     */
    saveUserData(partialData) {
        return new Promise((resolve, reject) => {
            if (!this.data) return reject("No initial data");

            // Extract only dirty fields from the new partial payload compared to previous state.
            // (If partialData is just `{money: 100}`, it will still only compare that subset)
            const simulatedNext = this._deepMerge(this.data, partialData);
            const dirtyUpdates = this._getDirtyValues(this.previousState, simulatedNext);

            if (Object.keys(dirtyUpdates).length === 0) {
                return resolve(); // Nothing to save
            }

            // 1. Update local cache optimistically
            this.data = simulatedNext;

            // Re-sync previous state
            this.previousState = JSON.parse(JSON.stringify(this.data));

            // Optimistic Lock Timestamp
            dirtyUpdates.lastUpdated = serverTimestamp();

            const updates = {};
            const flatten = (obj, prefix = '') => {
                for (const key in obj) {
                    // Do not flatten arrays or serverTimestamp object representations
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !obj[key]['.sv']) {
                        flatten(obj[key], prefix + key + '/');
                    } else {
                        updates[prefix + key] = obj[key];
                    }
                }
            };
            flatten(dirtyUpdates);

            if (!navigator.onLine) {
                console.warn('[DataManager] Offline. Queuing update.');
                this.offlineQueue.push(updates);
                localStorage.setItem('rpg_offlineQueue', JSON.stringify(this.offlineQueue));
                return resolve(); // Resolve optimistically for UI
            }

            // [Phase 5] Global Housing Sync: Publish houses to public node
            if (dirtyUpdates.houses !== undefined) {
                const publicHousesRef = ref(db, `maps/town/houses/${this.userId}`);
                set(publicHousesRef, dirtyUpdates.houses).catch(err => console.error("[DataManager] Public housing sync failed", err));
            }

            const userRef = ref(db, 'users/' + this.userId);
            update(userRef, updates)
                .then(() => resolve())
                .catch(err => {
                    console.error("[DataManager] Save failed, rejecting for rollback", err);
                    reject(err);
                });
        });
    }

    /**
     * Completely wipe and overwrite user data in Firebase with new state.
     * Prevents old merged data (like quest progress) from polluting a new game.
     */
    resetUserData(initialState) {
        return new Promise((resolve, reject) => {
            if (!this.userId) return reject("No user ID");

            const userRef = ref(db, 'users/' + this.userId);
            const newState = JSON.parse(JSON.stringify(initialState));
            newState.lastUpdated = serverTimestamp();

            set(userRef, newState)
                .then(() => {
                    this.data = newState;
                    this.previousState = JSON.parse(JSON.stringify(newState));
                    resolve(this.data);
                })
                .catch(err => {
                    console.error("[DataManager] Hard reset failed", err);
                    reject(err);
                });
        });
    }

    _processOfflineQueue() {
        if (!navigator.onLine || this.offlineQueue.length === 0) return;

        console.log(`[DataManager] Reconnected. Processing ${this.offlineQueue.length} offline actions.`);
        const userRef = ref(db, 'users/' + this.userId);

        // Merge queue into a single mass update
        const massUpdate = {};
        this.offlineQueue.forEach(updateObj => {
            Object.assign(massUpdate, updateObj);
        });

        massUpdate['lastUpdated'] = serverTimestamp(); // Sync time

        update(userRef, massUpdate).then(() => {
            console.log('[DataManager] Offline queue successfully synced.');
            this.offlineQueue = [];
            localStorage.setItem('rpg_offlineQueue', '[]');
        }).catch(err => console.error("[DataManager] Offline queue sync failed", err));
    }

    /**
     * Updates player position with throttling.
     * @param {number} x 
     * @param {number} y 
     * @param {string} mapId 
     */
    updatePosition(x, y, mapId, facing = 'down', petId = null, isFishing = false, isSeated = false, emojiId = 0, emojiTime = 0, inInstance = false, instanceBase = null, instanceOwner = null) {
        if (!this.data) return;

        // Sanity check: reject undefined/NaN coordinates to prevent Firebase errors
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.warn('[DataManager] updatePosition blocked: invalid coords', { x, y });
            return;
        }

        // Always update local data immediately for smooth rendering if accessed elsewhere
        const safeMapId = mapId || 'town';
        this.data.position = { x, y, mapId: safeMapId, facing, petId, isFishing, isSeated, emojiId, emojiTime, inInstance, instanceBase, instanceOwner };

        const now = Date.now();

        // If enough time has passed, send immediately
        if (now - this.lastPositionUpdate >= this.positionUpdateInterval) {
            this._sendPosition(x, y, mapId, facing, petId, isFishing, isSeated, emojiId, emojiTime, inInstance, instanceBase, instanceOwner);
            this.lastPositionUpdate = now;
            // Clear any pending timer since we just sent it
            if (this.positionTimer) {
                clearTimeout(this.positionTimer);
                this.positionTimer = null;
            }
        } else {
            // Otherwise, schedule it (trailing edge of throttle)
            // If there's already a pending update, update the pending values
            this.pendingPosition = { x, y, mapId, facing, petId, isFishing, isSeated, emojiId, emojiTime, inInstance, instanceBase, instanceOwner };

            if (!this.positionTimer) {
                const delay = this.positionUpdateInterval - (now - this.lastPositionUpdate);
                this.positionTimer = setTimeout(() => {
                    if (this.pendingPosition) {
                        this._sendPosition(
                            this.pendingPosition.x,
                            this.pendingPosition.y,
                            this.pendingPosition.mapId,
                            this.pendingPosition.facing,
                            this.pendingPosition.petId,
                            this.pendingPosition.isFishing,
                            this.pendingPosition.isSeated,
                            this.pendingPosition.emojiId,
                            this.pendingPosition.emojiTime,
                            this.pendingPosition.inInstance,
                            this.pendingPosition.instanceBase,
                            this.pendingPosition.instanceOwner
                        );
                        this.lastPositionUpdate = Date.now();
                        this.pendingPosition = null;
                        this.positionTimer = null;
                    }
                }, delay);
            }
        }
    }

    _sendPosition(x, y, mapId, facing, petId, isFishing, isSeated, emojiId = 0, emojiTime = 0, inInstance = false, instanceBase = null, instanceOwner = null) {
        const safeMapId = mapId || 'town';
        const userRef = ref(db, 'users/' + this.userId + '/position');
        const payload = { x, y, mapId: safeMapId, facing, petId, isFishing, isSeated, timestamp: Date.now(), inInstance, instanceBase, instanceOwner };
        if (emojiId && emojiTime) { payload.emojiId = emojiId; payload.emojiTime = emojiTime; }
        set(userRef, payload).catch(err => console.error("Pos update failed", err));
    }

    /**
     * 밀치기 이벤트를 타겟 유저의 Firebase 노드에 기록.
     * @param {string} targetUid
     * @param {string} direction 
     */
    pushPlayer(targetUid, direction) {
        const pushRef = ref(db, 'users/' + targetUid + '/pushedEvent');
        set(pushRef, { dir: direction, ts: Date.now(), by: this.userId }).catch(err => console.error("Push failed", err));
    }

    /**
     * 본인 노드의 pushedEvent를 감시하여 밀침 당했을 때 콜백 실행.
     * @param {Function} callback - (eventData) => void
     */
    startPushListener(callback) {
        const pushRef = ref(db, 'users/' + this.userId + '/pushedEvent');
        onValue(pushRef, (snap) => {
            const ev = snap.val();
            if (ev && callback) callback(ev);
        });
    }

    /**
     * Starts listening for multiplayer updates (other players and world items).
     * @param {Function} onEventCallback - Callback for system messages
     */
    startMultiplayerSync(onEventCallback = null) {
        // Path A: Users
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const allUsers = snapshot.val() || {};
            const now = Date.now();

            // Filter and update this.others
            this.others = {};
            for (const [uid, uData] of Object.entries(allUsers)) {
                if (uid === this.userId) continue; // Skip self

                // Cleanup: Check if inactive for > 1 minute (60000ms)
                // Use position timestamp if available, else lastLogin
                const lastActive = uData.position?.timestamp || uData.lastLogin || 0;
                if (now - lastActive > 60000) {
                    continue; // Skip inactive user
                }

                this.others[uid] = uData;
            }
        });

        // Path B: World Items
        const itemsRef = ref(db, 'world/items');
        onValue(itemsRef, (snapshot) => {
            this.worldItems = snapshot.val() || {};
        });

        // Path C: Global Events
        if (onEventCallback) {
            const eventsRef = query(ref(db, 'world/events'), limitToLast(5));
            onChildAdded(eventsRef, (snapshot) => {
                const val = snapshot.val();
                if (val && val.userId === this.userId) return; // Ignore own messages
                if (val && val.timestamp && Date.now() - val.timestamp < 10000) {
                    let message = val.message;
                    // [New] Payload Decoding
                    if (val.payload && typeof val.payload === 'object') {
                        try {
                            const { code, userId, itemId, weight } = val.payload;
                            const shortId = userId ? userId.slice(0, 4) : '????';
                            if (code === 'CATCH') {
                                const item = getItem(itemId);
                                const itemName = item ? item.name : itemId;
                                message = `[${shortId}]님이 ${itemName}을(를) 낚았습니다! (${weight}g)`;
                            } else {
                                message = `[정보] 서버 메시지 수신 실패`;
                            }
                        } catch (e) {
                            message = `[정보] 서버 메시지 수신 실패`;
                        }
                    }
                    if (message) onEventCallback(message);
                }
            });
        }

        // [Phase 5] Path D: Global Houses
        const housesRef = ref(db, 'maps/town/houses');
        onValue(housesRef, (snapshot) => {
            this.publicHouses = snapshot.val() || {};
        });
    }

    broadcastEvent(data) {
        const eventsRef = ref(db, 'world/events');
        const packet = {
            userId: this.userId,
            timestamp: Date.now()
        };
        if (typeof data === 'string') {
            packet.message = data;
        } else if (typeof data === 'object') {
            packet.payload = data;
        }
        push(eventsRef, packet);
    }

    /**
     * Test function to place an item in the world.
     * @param {string} itemId 
     * @param {number} x 
     * @param {number} y 
     */
    placeItemInWorld(itemId, x, y) {
        const itemsRef = ref(db, 'world/items');
        push(itemsRef, { itemId, x, y, createdAt: Date.now() });
    }
}
