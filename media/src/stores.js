import { writable } from 'svelte/store';

// Make a store for "universal coordinated time"
export const tickTock = writable(0.);
export const vMin = writable(-1.);
export const vMax = writable(1.);
export const colorMap = writable('plasma')
export const densityColormap = writable('PuBuGn')
export const keybinds = writable({'General': []});

// Used to add a keybind to the list of available keybinds. Does not add any event listeners.
export const registerKeybind = (key, description, category='General') => {
    keybinds.update((keybinds) => {
        if (!(category in keybinds)) {
            keybinds[category] = [];
        }

        keybinds[category].push({key, category, description});
        return keybinds;
    });
}