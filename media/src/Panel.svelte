<script>
    /**
     * Main 3Demos control panel, to the left of the scene.
     */
    import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    // import { flip } from 'svelte/animate';

    import { TabContent, TabPane } from 'sveltestrap';

    import HowTo from './docs/HowTo.svelte';
    import About from './docs/About.svelte';
    import Polls from './polls/Polls.svelte';

    import {
        // makeHSLColor,
        querySelectorIncludesText,
        tripleToHex,
        joinUrl,
    } from './utils';
    import { publishScene } from './sceneUtils';

    import Session from './session/Session.svelte';

    import Surface from './objects/Surface.svelte';
    import Level from './objects/Level.svelte';
    import Curve from './objects/Curve.svelte';
    import Field from './objects/Field.svelte';
    import Function from './objects/Function.svelte';
    import Vector from './objects/Vector.svelte';
    import Point from './objects/Point.svelte';
    import Solid from './objects/Solid.svelte';

    import { evaluate_cmap } from './js-colormaps';
    import { colorMap, demoObjects } from './stores';
    import Story from './Story.svelte';
    import { tick } from 'svelte';

    export let debug, currentMode;
    export let currentControls;
    export let currentChapter;
    export let gridStep, gridMax;
    export let isHost;
    export let onRenderObject, onDestroyObject;
    export let socket, pollResponses;
    export let animateIfNotAnimating;
    export let roomId, currentPoll;

    export let currentCamera;
    export let scene;
    export let requestFrameIfNotRequested;

    export let blowUpObjects = function () {};
    export let selectObject = function () {};
    export let selectedObjects;
    export let selectedPoint;
    export let chatBuffer;
    export let isPollsOpen;
    export let lockPoll;
    export let objectResponses;

    export let showPanel = true;

    const kindToComponent = {
        point: Point,
        vector: Vector,
        field: Field,
        graph: Function,
        curve: Curve,
        level: Level,
        surface: Surface,
        solid: Solid,
    };

    const onPublishScene = function () {
        publishScene($demoObjects, selectedObjects, socket);
    };

    let nextHue = 0;
    const nextColorUp = () => {
        const cm = evaluate_cmap(nextHue, $colorMap);
        nextHue += 1 / Math.sqrt(3);
        nextHue = nextHue % 1;
        // console.log('colorerer', nextHue, $colorMap);
        return tripleToHex(cm);
    };

    /**
     * This is a object of functions, keyed on the 3demos object kind, which return a (randomized) default
     * for each object kind.
     */
    const defaultParams = {
        point: () => ({
            a: `${Math.random()}`.slice(0, 5),
            b: `${Math.random()}`.slice(0, 5),
            c: `${Math.random()}`.slice(0, 5),
            t0: '0',
            t1: '1',
        }),
        vector: () => ({
            a: `${2 * Math.random() - 1}`.slice(0, 5),
            b: `${2 * Math.random() - 1}`.slice(0, 5),
            c: `${2 * Math.random() - 1}`.slice(0, 5),
            x: '0',
            y: '0',
            z: '0',
            t0: '0',
            t1: '1',
        }),
        curve: () => ({
            a: '0',
            b: '2*pi',
            x: 'cos(t)',
            y: 'sin(t)',
            z: `${
                1 / 4 + Math.round(10 * Math.random()) / 10
            } * cos(${Math.ceil(10 * Math.random()).toString()}*t)`,
        }),
        graph: () => ({
            a: '-2',
            b: '2',
            c: '-2',
            d: '2',
            z: `${Math.ceil(
                4 * Math.random(),
            ).toString()} / 4 * cos(${Math.ceil(
                3 * Math.random(),
            ).toString()}*x + ${Math.ceil(
                2 * Math.random(),
            ).toString()}*y)/(1 + x^2 + y^2)`,
            t0: '0',
            t1: '1',
        }),
        level: () => ({
            g: (Math.random() > 0.5 ? '-' : '') + 'x^2 + 2 y^2 - z^2',
            k: (Math.ceil(16 * Math.random()) / 2 - 4).toString(),
            a: '-2',
            b: '2',
            c: '-2',
            d: '2',
            e: '-2',
            f: '2',
        }),
        surface: () => {
            const k = Math.ceil(10 * Math.random());
            const l = Math.ceil(10 * Math.random());
            const R = (k / 20).toString();
            return {
                a: '0',
                b: `${(2.1 - k / 10).toString()} * pi`,
                c: `${(l / 10).toString()} * pi`,
                d: `${(l / 10 + 1).toString()} * pi`,
                x: `cos(u)*(1 + ${R}*sin(v))`,
                y: `sin(u)*(1 + ${R}*sin(v))`,
                z: `-${R}*cos(v)`,
            };
        },
        solid: () => {
            const k = Math.ceil(10 * Math.random());
            const l = Math.ceil(10 * Math.random());
            const m = Math.ceil(10 * Math.random());
            const n = Math.ceil(10 * Math.random());
            return {
                coords: 'rect',
                a: `-${k / 5}`,
                b: `${l / 5}`,
                c: `-${m / 5}`,
                d: `${n / 5}`,
                e: '0',
                f: `1 - ((x - ${m / 10})^2 + (y + ${k / 10})^2) / 8`,
            };
        },
        field: () => {
            const comps = ['1', '-1', 'x', 'y', 'z', '-x', '-y', '-z'];
            const p = comps[Math.floor(comps.length * Math.random())];
            const q = comps[Math.floor(comps.length * Math.random())];
            const r = comps[Math.floor(comps.length * Math.random())];

            return { p, q, r, nVec: '6' };
        },
    };

    let kindToAdd = null;

    $: if (kindToAdd) {
        const uuid = crypto.randomUUID();
        $demoObjects = [
            ...$demoObjects,
            {
                uuid,
                kind: kindToAdd,
                params: defaultParams[kindToAdd](),
                color: nextColorUp(),
            },
        ];

        selectedObjects = [];

        setTimeout(async () => {
            await tick();
            selectObject(uuid);
        }, 350); // why 350? I don't know. Autoscroll has some race condition I don't get.
        kindToAdd = null;
    }

    /**
     * Show the "Info" accordion item.
     */
    export const showMainPanelItem = function () {
        // Expand panel if it's hidden.
        showPanel = true;

        // Open the first accordion item.
        window.jQuery('#collapseOne').collapse('show');

        currentMode = 'session';
        // Because sveltestrap can't activate this tab programmatically:
        // https://github.com/bestguy/sveltestrap/issues/532
        const tabEl = querySelectorIncludesText(
            '.chapterBox .nav-tabs a',
            'Session',
        );
        tabEl.click();
    };

    onMount(() => {
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.keys()) {
            // const objectHolder = {};
            urlParams.forEach((val, key) => {
                // This is bad and stupid, and hopefully it will be done better.
                // make a viewStatus object, maybe?
                if (key === 'currentChapter') {
                    currentChapter = val;
                } else if (key === 'showPanel') {
                    showPanel = !(val === 'false');
                } else if (key === 'debug') {
                    debug = val === 'true';
                    console.log('debuggery: ', debug);
                }
            });
        }
    });

    const onKeyDown = (e) => {
        if (e.target.matches('input')) {
            return;
        } else if (e.key === 'h') {
            showPanel = !showPanel;
        }
    };
    window.addEventListener('keydown', onKeyDown, false);
</script>

<aside class="panel-wrapper" class:collapsed={!showPanel}>
    <div class="demos-panel">
        <div id="panelAccordion" class="accordion">
            <a href="/" title="Home" class="demos-logo">
                <img
                    alt="3Demos logo"
                    src={joinUrl(window.STATIC_PREFIX, './3demos-logo.svg')}
                />
            </a>

            <div class="accordion-item demos-panel-box">
                <h2 class="accordion-header">
                    <button
                        class="accordion-button collapsed"
                        id="info"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseOne"
                        aria-expanded="false"
                        aria-controls="collapseOne"
                    >
                        Info
                    </button>
                </h2>
                <div
                    id="collapseOne"
                    class="accordion-collapse collapse show"
                    data-bs-parent="#panelAccordion"
                >
                    <div class="chapterBox">
                        <div class="collapse-info">
                            <TabContent
                                on:tab={(e) => (currentMode = e.detail)}
                            >
                                <TabPane
                                    tabId="how-to"
                                    tab="Creation"
                                    active={currentMode === 'how-to'}
                                >
                                    <HowTo />
                                </TabPane>
                                <TabPane
                                    tabId="session"
                                    tab="Session"
                                    active={currentMode === 'session'}
                                >
                                    <Session
                                        bind:roomId
                                        bind:socket
                                        bind:currentPoll
                                        bind:chatBuffer
                                        {pollResponses}
                                        {selectedPoint}
                                        {selectedObjects}
                                        {isHost}
                                    />
                                </TabPane>
                                <TabPane
                                    tabId="story"
                                    tab="Story"
                                    active={currentMode === 'story'}
                                >
                                    <Story
                                        {scene}
                                        render={requestFrameIfNotRequested}
                                        on:animate={animateIfNotAnimating}
                                        bind:currentMode
                                    />
                                </TabPane>
                                <TabPane
                                    tabId="about"
                                    tab="About"
                                    active={currentMode === 'about'}
                                >
                                    <About />
                                </TabPane>
                            </TabContent>
                        </div>
                    </div>
                </div>
            </div>
            <!-- end .demos-panel-box -->

            {#if currentMode === 'session' && isHost}
                <div class="accordion-item demos-panel-box">
                    <h2 class="accordion-header">
                        <button
                            class="accordion-button collapsed"
                            id="polls"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#collapseTwo"
                            aria-expanded="false"
                            aria-controls="collapseTwo"
                        >
                            Polls
                        </button>
                    </h2>
                    <div
                        id="collapseTwo"
                        class="accordion-collapse collapse"
                        data-bs-parent="#panelAccordion"
                    >
                        <Polls
                            bind:pollResponses
                            bind:isPollsOpen
                            bind:lockPoll
                            bind:currentPoll
                            {socket}
                            {objectResponses}
                            render={requestFrameIfNotRequested}
                        />
                    </div>
                </div>
            {/if}

            <div class="accordion-item demos-panel-box">
                <h2 class="accordion-header">
                    <button
                        class="accordion-button collapsed"
                        id="objects"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseThree"
                        aria-expanded="false"
                        aria-controls="collapseThree"
                    >
                        Objects
                    </button>
                </h2>
                <div
                    id="collapseThree"
                    class="accordion-collapse collapse"
                    data-bs-parent="#panelAccordion"
                >
                    <div class="objectBoxOuter">
                        <div class="collapse-info">
                            <div class="object-box-title d-flex mb-2">
                                <h2 class="flex-grow-1 px-2">3D Objects</h2>
                            </div>
                            <div
                                class="btn-toolbar justify-content-between"
                                role="toolbar"
                            >
                                <div class="btn-group mb-2">
                                    <select
                                        bind:value={kindToAdd}
                                        class="demos-obj-select form-select bg-primary border-primary text-light"
                                        name="object-kind-adder"
                                    >
                                        <option value={null}>
                                            Add Object &#xFF0B;
                                        </option>
                                        <option value="point">point</option>
                                        <option value="vector">vector</option>
                                        <option value="curve">curve</option>
                                        <option value="graph">graph</option>
                                        <option value="level"
                                            >level surface</option
                                        >
                                        <option value="surface"
                                            >parametric surface</option
                                        >
                                        <option value="solid"
                                            >solid region</option
                                        >
                                        <option value="field"
                                            >vector field</option
                                        >
                                    </select>

                                    <button
                                        class="btn btn-sm btn-danger"
                                        on:click={blowUpObjects}
                                    >
                                        Clear Objects
                                        <i class="fa fa-trash" />
                                    </button>
                                </div>
                                {#if currentMode === 'session' && isHost}
                                    <button
                                        class="btn btn-sm btn-primary mb-2"
                                        on:click={onPublishScene}
                                    >
                                        Publish Scene
                                        <i class="bi bi-broadcast-pin" />
                                    </button>
                                {/if}
                            </div>

                            <div class="objectBoxInner">
                                <!-- Main Loop, if you will -->
                                {#each $demoObjects as { uuid, kind, params, color, title, animation, ...etc } (uuid)}
                                    <div
                                        transition:slide={{
                                            delay: 0,
                                            duration: 200,
                                            easing: quintOut,
                                        }}
                                    >
                                        <svelte:component
                                            this={kindToComponent[kind]}
                                            {scene}
                                            {onRenderObject}
                                            {onDestroyObject}
                                            camera={currentCamera}
                                            controls={currentControls}
                                            render={requestFrameIfNotRequested}
                                            {params}
                                            meta={etc}
                                            onClose={() => {
                                                $demoObjects =
                                                    $demoObjects.filter(
                                                        (b) => b.uuid !== uuid,
                                                    );
                                                selectedObjects =
                                                    selectedObjects.filter(
                                                        (objectId) =>
                                                            objectId !== uuid,
                                                    );
                                            }}
                                            bind:color
                                            bind:title
                                            bind:animation
                                            {uuid}
                                            {gridStep}
                                            {gridMax}
                                            on:animate={animateIfNotAnimating}
                                            bind:selectedObjects
                                            selected={selectedObjects.includes(
                                                uuid,
                                            )}
                                            onSelect={() => selectObject(uuid)}
                                            bind:selectedPoint
                                        />
                                    </div>
                                {/each}
                            </div>

                            <!-- debug buttons -->

                            {#if debug}
                                <div>
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 34,
                                                    kind: 'curve',
                                                    params: {
                                                        a: '0',
                                                        b: '2*pi',
                                                        x: 'cos(t)',
                                                        y: 'sin(t)',
                                                        z: '0',
                                                    },
                                                    color: '#aa33ff',
                                                    animation: true,
                                                },
                                                {
                                                    uuid: '34point22',
                                                    kind: 'point',
                                                    params: {
                                                        a: 'cos(2 t)',
                                                        b: 'sin(2 t)',
                                                        c: 'cos(2 t) + sin(2 t)',
                                                        t0: '0',
                                                        t1: '2 pi',
                                                    },
                                                    color: '#FF0000',
                                                    animation: false,
                                                },
                                                {
                                                    uuid: 345,
                                                    kind: 'vector',
                                                    params: {
                                                        a: 'cos(t)',
                                                        b: 'sin(t)',
                                                        c: '1',
                                                        x: 'cos(t)',
                                                        y: 'sin(t)',
                                                        z: '0',
                                                        t0: '0',
                                                        t1: '2*pi',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: false,
                                                },
                                            ];
                                        }}>curve anim</button
                                    >
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 34,
                                                    kind: 'curve',
                                                    params: {
                                                        a: '0',
                                                        b: '2*pi',
                                                        x: 'cos(t)',
                                                        y: 'sin(t)',
                                                        z: '0',
                                                    },
                                                    color: '#aa33ff',
                                                    animation: false,
                                                },
                                                {
                                                    uuid: '34point22',
                                                    kind: 'point',
                                                    params: {
                                                        a: 'cos(2 t)',
                                                        b: 'sin(2 t)',
                                                        c: 'cos(2 t) + sin(2 t)',
                                                        t0: '0',
                                                        t1: '2*pi',
                                                    },
                                                    color: '#FF0000',
                                                    animation: true,
                                                },
                                                {
                                                    uuid: 345,
                                                    kind: 'vector',
                                                    params: {
                                                        a: 'cos(t)',
                                                        b: 'sin(t)',
                                                        c: '1',
                                                        x: 'cos(t)',
                                                        y: 'sin(t)',
                                                        z: '0',
                                                        t0: '0',
                                                        t1: '2*pi',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: true,
                                                },
                                            ];
                                        }}>point/vec anim</button
                                    >
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 'agraph3847',
                                                    kind: 'graph',
                                                    params: {
                                                        a: '-1',
                                                        b: '1',
                                                        c: '-1',
                                                        d: '1',
                                                        z: 'x^2 - 3*cos(t) * x * y + y^2',
                                                        t0: '0',
                                                        t1: '2*pi',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: true,
                                                },
                                            ];
                                        }}>anim func</button
                                    >
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 'agraph3847',
                                                    kind: 'graph',
                                                    params: {
                                                        a: '-1',
                                                        b: '1',
                                                        c: '-1',
                                                        d: '1',
                                                        z: 'x^2 - 3*cos(t) * x * y + y^2',
                                                        t0: '0',
                                                        t1: '2*pi',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: false,
                                                },
                                            ];
                                        }}>unanim func</button
                                    >
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 'swirly1234',
                                                    kind: 'field',
                                                    params: {
                                                        p: 'x/2',
                                                        q: '-z',
                                                        r: 'y',
                                                        nVec: '5',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: true,
                                                },
                                            ];
                                        }}>anim field</button
                                    >
                                    <button
                                        on:click={() => {
                                            $demoObjects = [
                                                {
                                                    uuid: 'swirly1234',
                                                    kind: 'field',
                                                    params: {
                                                        p: 'x/2',
                                                        q: '-z',
                                                        r: 'y',
                                                        nVec: '5',
                                                    },
                                                    color: '#ff33ff',
                                                    animation: false,
                                                },
                                            ];
                                        }}>unanim field</button
                                    >
                                </div>
                            {/if}
                        </div>
                    </div>
                    <!-- end .objectBoxOuter -->
                </div>
            </div>
        </div>
        <!-- end .accordion -->
    </div>
    <button
        class="panel-hider"
        on:click={() => (showPanel = !showPanel)}
        title={showPanel ? 'Hide panel' : 'Show panel'}
    >
        {#if showPanel}
            <i class="bi bi-arrow-bar-left" />
        {:else}
            <i class="bi bi-arrow-bar-right" />
        {/if}
    </button>
</aside>

<!-- end .demos-panel -->

<!-- 
<div
    class="panel-button panel-hider bg-info bg-opacity-25 border border-info border-start-0 rounded-end-circle"
    title={showPanel ? 'Hide panel' : 'Show panel'}
    on:click={() => (showPanel = !showPanel)}
    on:keypress={() => (showPanel = !showPanel)}
    class:collapsed={!showPanel}
    style="--collapsed-width: translateX(-{panelWidth}px);"
>
    <div class="align-middle text-center">
        {#if showPanel}
            <i class="bi bi-arrow-bar-left" />
        {:else}
            <i class="bi bi-arrow-bar-right" />
        {/if}
    </div>
</div> -->

<style>
    :global(#panelAccordion .collapse-info .nav-link:not(.active)) {
        color: white;
    }

    .demos-logo img {
        height: 38px;
    }

    .panel-wrapper {
        position: relative;
        margin: 0;
        width: fit-content;
        height: fit-content;
        transition: transform 100ms ease-in-out;
        z-index: 1;
    }
    .demos-panel {
        min-width: 300px;
        /* default width */
        width: 370px;
        max-width: 60vw;
        height: fit-content;
        max-height: 100%;

        background-color: transparent;

        overflow-y: auto;
        overflow-x: hidden;

        resize: horizontal;
    }
    .panel-wrapper.collapsed {
        transform: translateX(-100%);
    }

    .panel-hider {
        --width: 25px;
        width: var(--width);
        position: absolute;
        right: calc(-1 * var(--width));
        top: 46px;
        border-radius: 0 5px 5px 0;
    }

    .chapterBox,
    .objectBoxOuter {
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 0.5em;
        border-top-left-radius: 0rem;
        border-top-right-radius: 0rem;
        border: 1px solid black;
        padding: 5px;
        transition: opacity 0.8s;
        box-sizing: border-box;

        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
    }

    .chapterBox {
        text-align: unset;
    }

    .objectBoxInner {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
        max-height: 60vh;
        overflow-y: auto;
    }

    .object-box-title {
        display: flex;
        font-size: 1.5em;
        justify-content: space-between;
    }

    .accordion-header {
        font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            Roboto,
            Oxygen,
            Ubuntu,
            Cantarell,
            'Open Sans',
            'Helvetica Neue',
            sans-serif;
    }

    .demos-obj-select {
        border-bottom-right-radius: 0;
        border-top-right-radius: 0;
        width: inherit;
    }
</style>
