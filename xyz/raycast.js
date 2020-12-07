'use strict';
export {};
import {maingroup, camera} from './graphicsboiler.js';
import {dataToMarkersGui} from './xyz.js';
const {E, X} = window;
import {THREE} from "./threeH.js"; // import * as THREE from "./jsdeps/three121.module.js";

/** raycasting */
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
document.onmousemove = onMouseMove;
document.onclick = onMouseMove;
let lastface, lastcol, lastint0;

function onMouseMove( event ) {
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    if (event.target !== E.canvas || !(event.ctrlKey || event.type === 'click'))  return;
    mouse.x = ( event.offsetX / E.canvas.style.width.replace('px','') ) * 2 - 1;
    mouse.y = - ( event.offsetY / E.canvas.style.height.replace('px','') ) * 2 + 1;

    // ~~~~~~~~ each frame?
    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera( mouse, camera );
    const th = X.raywidth || 0.2;
    raycaster.params.Points.threshold = th;
    raycaster.params.Line.threshold = th;   // ?? have the three.js rules changed ??
    // raycaster.linePrecision = th;

    // calculate visible objects intersecting the picking ray
    console.time('inter')
    const visibles = []; maingroup.traverseVisible(v => visibles.push(v))
    var intersects = raycaster.intersectObjects( visibles, false );
    console.timeEnd('inter')
    const num = intersects.length;
    intersects = intersects.splice(0, 10);

    //for ( var i = 0; i < intersects.length; i++ ) {
    //    //intersects[ i ].object.material.color.set( 0xff0000 );
    //
    //}
    E.msgbox.innerHTML = `hits ${num} shown ${intersects.length}. Hover for details.<br>`;

    // colour picked face (eg but not necessarily virus polygon)
    let int0 = intersects[0];
    let newface = int0 && int0.face;
    if (newface !== lastface) {
        if (lastface) {
            lastface.color.copy(lastcol);
            lastint0.object.geometry.colorsNeedUpdate = true;
        }
        if (newface) {
            lastcol = newface.color.clone();
            newface.color.setRGB(1,1,0);
            int0.object.geometry.colorsNeedUpdate = true;

            // bit below dependent on chainset link/dependency
            // TODO: change filterbox without disturbing related things such as COL:
            if (newface.chainset) {
                const chainsa = Array.from(newface.chainset);
                E.filterbox.value = '?[' + chainsa + '].includes(chainn)';
            }
        } else {
            E.filterbox.value = '';
        }
        dataToMarkersGui();
    }
    lastface = newface;
    lastint0 = int0;


    intersects.forEach(function(ii) {
    //const ii = intersects[0];
        const xyz = ii.object.xyz;
        let frow;
        if (xyz) {
            const s = [];
            const ind = ii.index;
            // const row = xyz.datas[ii.index];
            for (const name in xyz.namecols) { 
                const v = xyz.val(name, ind); 
                if (typeof v !== 'object') 
                    s.push(name + ': ' + v);
            }
            frow = s.join('<br>');
        } else {
            frow = 'no detailed information';
        }
        const indshow = ii.face ? ii.faceIndex : ii.index;
        E.msgbox.innerHTML += `<span>${ii.object.name}:${indshow} ${ii.point.x.toFixed()}, ${ii.point.y.toFixed()}, ${ii.point.z.toFixed()}</span>
            <span class="help">${frow}</span><br>
        `;
   });


    // console.log(ii ? ii.object : 'nohit');
    if (lastface && !intersects.length) {
        lastface.color.copy(lastface.ocol);
        E.filterbox.value = '';
        dataToMarkersGui();
        lastface = undefined;
    }
}
