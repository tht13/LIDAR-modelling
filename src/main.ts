import * as $ from "jquery";
import * as THREE from "three";
import { OrbitControls } from "./controls";
import * as Stats from "stats.js";
import { ipcRenderer } from "electron";

let scene;
let camera;
let renderer;
let controls: THREE.OrbitControls;
let stats;

$(document).ready(async e => {
    loadScene();
    const t1 = new Date().getTime();
    await drawPoints();
    const t2 = new Date().getTime();
    console.log(t2 - t1);
    startRender();
});

class Color {
    public readonly r: number;
    public readonly g: number;
    public readonly b: number;
    constructor(r: string, g: string, b: string) {
        this.r = parseFloat(r);
        this.g = parseFloat(g);
        this.b = parseFloat(b);
    }
}

class Point {
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;
    public readonly color: Color;
    constructor(x: string, y: string, z: string, r: string, g: string, b: string) {
        this.x = parseInt(x);
        this.y = parseInt(y);
        this.z = parseInt(z);
        // this.color = new Color(r, g, b);
    }
}

// async function getChunk() {
//     return new Promise<string>((res, rej) => {
//         ipcRenderer.once("data", (e, chunk) => res());
//         setTimeout(res, 1000);
//     });
// }

// async function* loadPointsGen() {
//     let done = false;
//     let data = "";
//     ipcRenderer.send("open", "points.txt");
//     ipcRenderer.on("data", (e, chunk) => data += chunk);
//     while (!done) {
//         await getChunk();
//         if (data === "") {
//             done = true;
//             break;
//         }
//         let nl = data.lastIndexOf("\n");
//         let newStart = nl + 1;
//         nl = data.slice(nl - 1, nl) === "\r" ? nl - 1 : nl;
//         let slice = data.substring(0, nl);
//         data = data.slice(newStart);
//         yield* slice.split(/\r?\n/g)
//     }
//     ipcRenderer.once("close", e => {
//         done = true;
//         ipcRenderer.removeAllListeners("data");
//     });
// }

async function* loadPoint() {
    yield* await new Promise<string[]>((res, rej) => {
        let data = "";
        ipcRenderer.send("open", "points.txt");
        ipcRenderer.on("data", (e, chunk) => data += chunk);
        ipcRenderer.once("close", e => {
            ipcRenderer.removeAllListeners("data");
            res(data.split(/\r?\n/g));
        });
    });
}

async function* pointsGenerator() {
    for await (let line of loadPoint()) {
        if (line == "") {
            continue;
        }
        const split = line.split(" ");
        if (split.length === 6 && !isNaN(parseInt(split[0]))) {
            yield new Point(split[0], split[1], split[2], split[3], split[4], split[5]);
        }
    }

}

async function drawPoints() {
    let count = 0;
    const div = 2;
    const geometry = new THREE.BoxBufferGeometry(5, 5, 5);
    let material = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    for await (let point of pointsGenerator()) {
        if (count++ % div !== 0) continue;

        const cube = new THREE.Mesh(geometry, material);

        cube.translateX(point.x - 600000);
        cube.translateZ(point.y - 4214000);
        cube.translateY(point.z);
        scene.add(cube);
    }
    console.log(`${count / div} points loaded`);
}

function loadScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.z = 3000;
    camera.position.y = 2000;


    scene.add(new THREE.AmbientLight(0x444444));
    const light1 = new THREE.DirectionalLight(0xffffff, 0.5);
    light1.position.set(1, 1, 1);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
    light2.position.set(0, -1, 0);
    scene.add(light2);
}

function startRender() {
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xcccccc, 1);

    controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.25;

    // performance monitor
    stats = new Stats();
    document.body.appendChild(stats.dom);

    document.body.appendChild(renderer.domElement);
    render();
}


function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
    stats.update();
}

window.onresize = (e) => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

