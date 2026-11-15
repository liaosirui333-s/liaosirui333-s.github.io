

import * as THREE from './js/three.module.js';


import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
// 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF); // 设置背景颜色

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
const planeGeometry = new THREE.PlaneGeometry(200, 200);
const planeMaterial = new THREE.ShadowMaterial({ opacity: 1, color: 0x379FFF });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -10;
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


// 设置相机位置
camera.position.set(0, 50, 300);
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

// Rain keeps falling through the scene rather than collecting on a fixed floor.
const raindropMaterial = new THREE.MeshBasicMaterial({ color: 0x379FFF });
const raindropGeometry = new THREE.SphereGeometry(0.5, 6, 6);
const rainGroup = new THREE.Group();
scene.add(rainGroup);
const rainClock = new THREE.Clock();
const normal = () => Math.sqrt(-2 * Math.log(Math.max(Math.random(), 0.000001))) * Math.cos(Math.random() * Math.PI * 2);

function createRaindrop(initial = false) {
    if (document.hidden || rainGroup.children.length >= 180) return;
    const drop = new THREE.Mesh(raindropGeometry, raindropMaterial);
    // A soft distribution has no hard rectangular sides or front/back boundary.
    drop.position.set(normal() * 245, initial ? 130 - Math.random() * 320 : 130 + Math.random() * 30, normal() * 58);
    drop.userData.speed = 25 + Math.random() * 18;
    drop.userData.driftX = 1.5 + normal() * 2;
    drop.userData.driftZ = normal() * 1.5;
    drop.userData.bottom = -245 - Math.random() * 100;
    rainGroup.add(drop);
}
for (let i = 0; i < 70; i++) createRaindrop(true);
setInterval(() => createRaindrop(), 140);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 动画中更新线的中点位置以模拟风的效果
let lastWindFrame = 0;
function animate(timestamp = 0) {
    requestAnimationFrame(animate);
    if (document.hidden || timestamp - lastWindFrame < 33) return;
    lastWindFrame = timestamp;
    const rainDelta = Math.min(rainClock.getDelta(), 0.06);

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
        drop.position.y -= drop.userData.speed * rainDelta;
        drop.position.x += (drop.userData.driftX + Math.sin(time * 0.7) * 1.5) * rainDelta;
        drop.position.z += drop.userData.driftZ * rainDelta;
        if (drop.position.y < drop.userData.bottom) rainGroup.remove(drop);
    }
    controls.update();
    renderer.render(scene, camera);
}










animate();