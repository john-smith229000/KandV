class GameState {
    constructor() {
        if (!GameState.instance) {
            this.defaults = {
                currentMap: 'map',
                spawnPos: { x: 13, y: 11 },
                storyFlags: {}
            };
            this.state = { ...this.defaults };
            GameState.instance = this;
        }
        return GameState.instance;
    }

    // Load state from a save object (e.g., from server or local storage)
    load(saveData) {
        this.state = { ...this.defaults, ...saveData };
    }

    // Get a value from the state
    get(key) {
        return this.state[key];
    }

    // Set a value in the state
    set(key, value) {
        this.state[key] = value;
    }

    // Get the entire state object
    getState() {
        return this.state;
    }

    // Set a story flag
    setFlag(flag, value) {
        this.state.storyFlags[flag] = value;
    }

    // Check a story flag
    getFlag(flag) {
        return this.state.storyFlags[flag];
    }
}

const instance = new GameState();
export default instance;