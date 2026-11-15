

import * as THREE from './js/three.module.js';


import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
// 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF); // 设置背景颜色

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // 启用阴影
document.body.appendChild(renderer.domElement);


// // 初始化OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // 启用阻尼效果
controls.dampingFactor = 0.05; // 阻尼系数
controls.screenSpacePanning = false; // 不允许屏幕空间平移
controls.minDistance = 50; // 最小距离
controls.maxDistance = 500; // 最大距离

// 添加光源
const light = new THREE.DirectionalLight(0xffffff, 10);
light.position.set(0, 50, 50);
light.castShadow = true; // 光源投射阴影
scene.add(light);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 添加地面
const GROUND_Y = -70;
const planeGeometry = new THREE.PlaneGeometry(3000, 3000);
const planeMaterial = new THREE.ShadowMaterial({ opacity: 1, color: 0x379FFF });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = GROUND_Y;
plane.receiveShadow = true; // 地面接收阴影
planeMaterial.needsUpdate = true;
planeMaterial.depthWrite = false; // Invisible ground must not clip falling drops.
scene.add(plane);

// 添加两根杆子
const cylinderGeometry = new THREE.CylinderGeometry(2, 2, 100, 32);
const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
const cylinder1 = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
const cylinder2 = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

cylinder1.position.x = -320;
cylinder2.position.x = 320;
cylinder1.castShadow = true; // 杆子投射阴影
cylinder2.castShadow = true;

scene.add(cylinder1);
scene.add(cylinder2);


// Choose a fresh viewing angle on every page load, without clipping the scene.
let previousAzimuth = NaN;
try { previousAzimuth = parseFloat(sessionStorage.getItem('rui-last-view-angle')); } catch {}
let azimuth;
for (let attempt = 0; attempt < 24; attempt++) {
    azimuth = Math.random() * Math.PI * 2;
    const separation = Math.abs(Math.atan2(Math.sin(azimuth - previousAzimuth), Math.cos(azimuth - previousAzimuth)));
    if (Math.abs(Math.cos(azimuth)) > 0.24 && (!Number.isFinite(previousAzimuth) || separation > 0.38)) break;
}
const elevation = (8 + Math.random() * 38) * Math.PI / 180;
const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
const up = new THREE.Vector3().crossVectors(direction, right);
controls.target.set(0, 20, 20);
const verticalTangent = Math.tan(camera.fov * Math.PI / 360);
const horizontalTangent = verticalTangent * camera.aspect;
let distance = 230;
for (const x of [-340, 340]) for (const y of [-80, 115]) for (const z of [-90, 130]) {
    const offset = new THREE.Vector3(x, y, z).sub(controls.target);
    const fit = Math.max(Math.abs(offset.dot(right)) / horizontalTangent, Math.abs(offset.dot(up)) / verticalTangent);
    distance = Math.max(distance, offset.dot(direction) + fit * 1.12);
}
distance *= 1 + Math.random() * 0.08;
camera.position.copy(controls.target).addScaledVector(direction, distance);
controls.maxDistance = Math.max(1000, distance * 1.5);
controls.update();
try { sessionStorage.setItem('rui-last-view-angle', String(azimuth)); } catch {}
renderer.render(scene, camera);

const points = [
    new THREE.Vector3(-325, 40, 0), // 左端点，固定在左柱子顶部
    new THREE.Vector3(0, 100, 0), // 中点，初始位置
    new THREE.Vector3(325, 40, 0) // 右端点，固定在右柱子顶部
];

// 使用CatmullRomCurve3创建平滑曲线
const curve = new THREE.CatmullRomCurve3(points);
const pointsCurve = curve.getPoints(50); // 生成曲线上的50个点
const geometryCurve = new THREE.BufferGeometry().setFromPoints(pointsCurve);

const lineMaterial = new THREE.LineBasicMaterial({ color: 0xFF9BEF });
const line = new THREE.Line(geometryCurve, lineMaterial);
scene.add(line);

// 创建两条额外的线，位置稍低
const line2 = new THREE.Line(geometryCurve.clone(), lineMaterial);
line2.position.y = -10; // 下移10单位
scene.add(line2);

const line3 = new THREE.Line(geometryCurve.clone(), lineMaterial);
line3.position.y = -20; // 下移20单位
scene.add(line3);






// 监听鼠标移动事件，更新中点的 x 位置
document.addEventListener('mousemove', function(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - bounds.left) / bounds.width) * 1 - 1; // 将鼠标位置转换为归一化设备坐标 (NDC)
    const xPosition = mouseX * 75; // 将 NDC 转换为我们场景中的 x 坐标范围
    points[1].x = xPosition; // 更新中点的 x 位置
});

// Keep the original rhythm: one drop every 400ms, falling one unit per frame.
const raindropMaterial = new THREE.MeshBasicMaterial({ color: 0x379FFF });
const raindropGeometry = new THREE.SphereGeometry(0.5, 6, 6);
const rainGroup = new THREE.Group();
scene.add(rainGroup);
const normal = () => Math.sqrt(-2 * Math.log(Math.max(Math.random(), 0.000001))) * Math.cos(Math.random() * Math.PI * 2);

// Settled drops stay on the ground. A soft spatial distribution has no box edge.
const settledCapacity = 2000;
const settledPositions = new Float32Array(settledCapacity * 3);
const settledGeometry = new THREE.BufferGeometry();
settledGeometry.setAttribute('position', new THREE.BufferAttribute(settledPositions, 3));
settledGeometry.setDrawRange(0, 0);
const settledRain = new THREE.Points(settledGeometry, new THREE.PointsMaterial({ color: 0x379FFF, size: 1.3 }));
settledRain.frustumCulled = false;
scene.add(settledRain);
let settledCount = 0;
let settledIndex = 0;

function createRaindrop() {
    if (document.hidden || rainGroup.children.length >= 180) return;
    const drop = new THREE.Mesh(raindropGeometry, raindropMaterial);
    drop.position.set(normal() * 245, 100, normal() * 58);
    rainGroup.add(drop);
}
setInterval(createRaindrop, 400);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 动画中更新线的中点位置以模拟风的效果
function animate(timestamp = 0) {
    requestAnimationFrame(animate);
    if (document.hidden) return;

    // 获取当前时间
    const time = Date.now() * 0.001;



    // 计算中点的新位置，增加湍流效果
    const midPointY1 = 90 + Math.cos(time * 2) * 5;
    const midPointY2 = 90 + Math.cos(time * 2) * 5;
    const midPointY3 = 80 + Math.sin(time * 2) * 5;

    // 更新曲线的中点位置
    points[1].y = midPointY1;
    points[1].z = 20; // 您可以根据需要设置Z坐标
    const newCurve1 = new THREE.CatmullRomCurve3(points);
    const newPointsCurve1 = newCurve1.getPoints(50);
    geometryCurve.setFromPoints(newPointsCurve1);
    geometryCurve.attributes.position.needsUpdate = true;

    points[1].y = midPointY2;
    points[1].z = 90; // 更新Z坐标
    const newCurve2 = new THREE.CatmullRomCurve3(points);
    const newPointsCurve2 = newCurve2.getPoints(50);
    line2.geometry.setFromPoints(newPointsCurve2);

    points[1].y = midPointY3;
    points[1].z = 70; // 更新Z坐标
    const newCurve3 = new THREE.CatmullRomCurve3(points);
    const newPointsCurve3 = newCurve3.getPoints(50);
    line3.geometry.setFromPoints(newPointsCurve3);

    // 更新雨滴位置
    for (let i = rainGroup.children.length - 1; i >= 0; i--) {
        const drop = rainGroup.children[i];
        drop.position.y -= 1;
        if (drop.position.y <= GROUND_Y) {
            const index = settledIndex * 3;
            settledPositions[index] = drop.position.x;
            settledPositions[index + 1] = GROUND_Y + 0.02;
            settledPositions[index + 2] = drop.position.z;
            settledIndex = (settledIndex + 1) % settledCapacity;
            settledCount = Math.min(settledCount + 1, settledCapacity);
            settledGeometry.setDrawRange(0, settledCount);
            settledGeometry.attributes.position.needsUpdate = true;
            rainGroup.remove(drop);
        }
    }
    controls.update();
    renderer.render(scene, camera);
}










animate();
