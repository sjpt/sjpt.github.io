'use strict';

// export {makevirchains, virchaindists};
/** dynamic expansion, todo add easier scripting */
import {centrerange, col3, dataToMarkersGui, setPointSize} from '../xyz.js';
import {posturiasync, log} from '../basic.js';

import {pdbReader} from '../plugins/pdbreader.js';
import {addToMain, fullcanvas, orbcamera, renderer, usePhotoShader} from '../graphicsboiler.js';
import {COLS} from '../cols.js';
import {THREE} from '../threeH.js';
const {E} = window;

let folddemo_st;  // folddemo start time to help script
let virchains = [];
let polygonmesh, rlines, groupgeom, myxyz;


function folddemofun(tt = 10000, gap = 2000) {
    if (centrerange.x === Infinity) {  // no data yet, read data and pend
        posturiasync('data/4bcufullCA.pdb',
            (d,f) => { myxyz = pdbReader(d,f); folddemofun(); });
        return;
    }

    
    virchaindists();
    virusshow();

    setPointSize(5);
    COLS.set('resname');
    orbcamera.position.set(0,0,250);
    fullcanvas(true);

    if (!folddemo_st) requestAnimationFrame(foldframe);
    folddemo_st = Date.now();
    function foldframe() {
        const t = Date.now() - folddemo_st;
        if (t > 2 * tt + gap) { expandchain(0,0); folddemo_st = undefined; return; }
        if (t < tt) {
            const dt = t / tt;
            expandchain(0.5 + 0.5 * dt, 0.5 - 0.5 * dt);
        } else if (t > tt + gap) {
            const dt = (t - tt - gap) / tt;
             expandchain(1-dt, 0);
        }
        requestAnimationFrame(foldframe);
    }
    document.title = 'xyzviewer: fold demo';
}

folddemofun();
// //document.addEventListener("DOMContentLoaded",()=>{
//     const expbutton = document.createElement('button');
//     expbutton.id = 'xexpbutton';
//     E.gui.appendChild(expbutton);
//     expbutton.textContent = 'fold demo';
//     var exphelp =  `<span class="help">Run demo of folding virus</span>`
//     W.appendNodeFromHTML(window.gui, exphelp);
//     expbutton.onclick = () => folddemofun();
// //});



/** make chains based on backbone distances > l, and compute centroids and other chain stats
 * only relevant to virus/folddemo; assumes we only have CA atoms, and chains aren't sensibly defined
 */
function makevirchains(l = 5, cols = myxyz.namecols, ) {
    const xc = myxyz.namecols['x'], yc = myxyz.namecols['y'], zc = myxyz.namecols['z'];
    // const chainc = cols.chainn = new Float32Array(xc.length);
    const chainc = cols.chain; // just override the all 'A' chain field
    virchains = [];
    let c = -1, i = -1;
    let s = new THREE.Vector3(), near = s, far = s;    // values only used to keep compiler quiet abut not set, set poperly in startc()
    const posi = new THREE.Vector3(), posn = new THREE.Vector3();
    startc();

    function startc() {
        c++;
        s = new THREE.Vector3();
        near = new THREE.Vector3(Infinity, Infinity, Infinity);
        far = new THREE.Vector3(0,0,0);
        virchains[c] = {start: i+1, s, near, far};
    }
    for (i = 0; i < xc.length; i++) {
        chainc[i] = c;
        posi.set(xc[i], yc[i], zc[i]);
        posn.set(xc[i+1], yc[i+1], zc[i+1]);
        s.addVectors(s, posi);
        const dummyend = i === xc.length - 1;
        const d = dummyend ? 99999 : posi.distanceTo(posn);
        if (posi.length() < near.length()) near.copy(posi);
        if (posi.length() > far.length()) far.copy(posi);
        if (d > l) {  // complete chainn
            const ch = virchains[c];
            ch.n = i - ch.start + 1;
            ch.centroid = s.multiplyScalar(1/ch.n);
            ch.end = i;
            if (!dummyend) startc();
        }
    }

    console.log('number of chains for separation', l, 'is',  c);
    myxyz.ranges.chain = myxyz.genstats('chain');
    return virchains;
}



/** compute chain distances,
 * perform related topology to find groups
 * and draw graphics,
 * This has some distances very specific to 4bcu built in to the analysis; (in cols)
sc is scale.  1 will have the near particles on the vertices */
function virchaindists(sc = 1) {
    if (virchains.length === 0) makevirchains();
    const dds = []; // all close distances

    if (!groupgeom) {
        groupgeom = new THREE.Group();
        addToMain(groupgeom, 'pdbgroup');
    }
    groupgeom.scale.set(sc,sc,sc);
    // find the close pairs
    var linegeom = new THREE.Geometry();

    virchains.forEach(c => c.close=[]);
    // cols is based on the known centroid distances for 4bcu
    const cols = { 30: col3(1,1,1), 34: col3(1,1,0), 42: col3(1,0,0), 49: col3(0,0,1) }; // colours for known lengths
    for (let i=0; i < virchains.length; i++) {
        const chi = virchains[i];
        for (let j=i+1; j < virchains.length; j++) {
            const chj = virchains[j];
            const d = chi.centroid.distanceTo(chj.centroid);
            dds.push({i, j, d});
            if (d < 50) {   // close enough to be of interest, collect the info and draw the line
                chi.close.push(j);
                chj.close.push(i);
                linegeom.vertices.push(chi.near);
                linegeom.vertices.push(chj.near);
                const colx = cols[Math.floor(d)]
                const col = colx ? colx.clone() : col3(0,1,0);
                linegeom.colors.push(col);
                linegeom.colors.push(col);
            }
        }
    }
    const linemat = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 1, linewidth: 1, vertexColors: true} ); // THREE.VertexColors } );
    //maingroup.remove(rlines);
    groupgeom.remove(rlines);
    rlines = new THREE.LineSegments(linegeom, linemat);
    addToMain(rlines, 'poly lines', groupgeom);

    // refine dds to get found close distances; result was used (manually) in setting up cols above
    dds.sort((a,b) => a.d - b.d);
    const ds = dds.map(s => s.d);
    const dists = ds.filter(function(v,i,a) { if(v < a[i-1]+0.2) return 0; return 1; });
    log('discrete distances found, ascending order', dists);

    // find triangles
    // classify them into types according to distances
    // group triangles into pentagons where appropriate
    // draw solid with triangles
    var trigeom = new THREE.Geometry();
    //let groups = [];
    let n = 0;
    for (let i=0; i < virchains.length; i++) {
        const chi = virchains[i];
        const cl = chi.close;
        const a = chi.centroid;
        cl.forEach(j => {
            const chj = virchains[j];
            const b = chj.centroid;
            if (j <= i) return;
            cl.forEach(k => {
                if (k <= j) return;
                if (chj.close.indexOf(k) === -1) return;

                   const chk = virchains[k];
                const c = chk.centroid;

                // classify the face, and collect pentagons if appropriate
                let chainset = new Set([i,j,k]);  // for triangle this is it, for pentagon it will be extended or replaced
                const ds = [ Math.floor(a.distanceTo(b)), Math.floor(a.distanceTo(c)), Math.floor(b.distanceTo(c))];
                const ck = ds.sort().join('');
                let col;
                switch(ck) {
                    case '304949': {             // this will be one long trianlge across pentagon
                        col=cols[30];
                        let pentagon = chi.pentagon || chj.pentagon || chk.pentagon || chainset;
                        pentagon.add(i).add(j).add(k);
                        chi.pentagon = chj.pentagon = chk.pentagon = pentagon;
                        chainset = pentagon;
                        }
                        break;
                    case '303049': return; // col=cols[30]; break;  // ignore wide triangle from pentagon, reduce overcoverage
                    case '424242':
                        chi.trimer = chj.trimer = chk.trimer = chainset;
                        col=cols[42];
                        break;    // this is a trimer (red)
                    case '303442': col=cols[49]; break;
                    default: col=cols[49]; break;
                }

                // collect the face as graphics object
                trigeom.vertices.push(chi.near); // (a);
                trigeom.vertices.push(chj.near); // b);
                trigeom.vertices.push(chk.near); // c);

                const face = new THREE.Face3(n++, n++, n++, undefined, col.clone());
                face.chainset = chainset;
                trigeom.faces.push(face);
            });
        });
    }

    // convert pentagon and trimers to arrays and compute their centres. quite a bit of duplicated work below
    for (let i=0; i < virchains.length; i++) {
        const chi = virchains[i];
        const tri = chi.trimer = Array.from(chi.trimer);
        chi.tripos =  tri.reduce( (a,v) => a.addVectors(a,virchains[v].centroid), new THREE.Vector3()).multiplyScalar(1/3);
        const pent = chi.pentagon = Array.from(chi.pentagon);
        chi.pentpos =  pent.reduce( (a,v) => a.addVectors(a,virchains[v].centroid), new THREE.Vector3()).multiplyScalar(1/5);
    }
    log('chain tripos etc computed in chaindists');

    // finish off the mesh ready for drawing
    trigeom.computeFaceNormals();
    const meshmat = new THREE.MeshPhongMaterial( { color: 0xffffff, opacity: 1, vertexColors: true /*THREE.VertexColors*/, side: THREE.DoubleSide } );
    if (polygonmesh) groupgeom.remove(polygonmesh);
    polygonmesh = new THREE.Mesh(trigeom, meshmat);
    addToMain(polygonmesh, 'polygon', groupgeom);

    return dds;
}

/** expand all the chains out from their trimer, pentagon and centroid
 * only relevent to folddemo. should be moved if possible
 */
function expandchain(trik = 0, pentk = 0, cenk = 0) {
    const xc = myxyz.namecols['x'], yc = myxyz.namecols['y'], zc = myxyz.namecols['z'], chainc = myxyz.namecols['chain'];
    let opos = myxyz.opos;
    if (!opos) {
        opos = myxyz.opos = [];
        for (let i = 0; i < xc.length; i++)
            myxyz.opos[i] = new THREE.Vector3(xc[i], yc[i], zc[i]);
    }

    if (!rlines) virchaindists();
    for (let i=0; i < xc.length; i++) {
        const ch = virchains[chainc[i]];
        const cen = ch.centroid.clone().multiplyScalar(cenk);
        const tri = ch.tripos.clone().multiplyScalar(trik);
        const pent = ch.pentpos.clone().multiplyScalar(pentk);
        cen.add(tri).add(pent).add(opos[i]);
        xc[i] = cen.x;
        yc[i] = cen.y;
        zc[i] = cen.z;
    }
    dataToMarkersGui();  // << could optimize this to avoid remake
}

/** set up to show virus */
function virusshow() {
    E.colourby.value = 'fixed';
    if (usePhotoShader) {  // quick demo for Steve
        myxyz.setPointSize(2);
        E.colourby.value = 'random';
    }
    dataToMarkersGui();
    if (!renderer.xr.getSession()) orbcamera.position.z = 200;
}
