// three.js를 한 곳에서만 불러온다. 색 관리(sRGB 변환)는 원본 그대로 끈다.
import * as THREE from '../vendor/three.module.min.js';
THREE.ColorManagement.enabled = false;
export { THREE };
export const V3 = THREE.Vector3, Q = THREE.Quaternion;
