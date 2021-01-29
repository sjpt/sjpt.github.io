'use strict';
export {pdbReader};
import {ggb} from '../graphicsboiler.js'; // addToMain
import {dataToMarkersGui, XYZ} from '../xyz.js';
import {addFileTypeHandler, queryVariables} from '../basic.js';
const {E} = window;
import {THREE} from "../threeH.js";


addFileTypeHandler('.pdb', pdbReader);
addFileTypeHandler('.vdb', pdbReader);

let chainlines, myxyz;

/** call pdbReader when pdb data read and ready to be parsed */
function pdbReader(data, fid) {
    myxyz = new XYZ(undefined, fid);  // will become current
    myxyz.makechainlines = makechainlines;
    const lines = data.split('\n');
    const format = [
    // [1,4, 'atom'], //    “ATOM”        character
    [7,11, 'atid'], //    Atom serial number    right    integer
    [13,16, 'atname'], //    Atom name    left*    character
    [17,17, 'altloc'], //    Alternate location indicator        character
    [18,20, 'resname'], // §    Residue name    right    character
    [22,22, 'chain'], //     Chain identifier        character
    [23,26, 'resid'], //     Residue sequence number    right    integer
    //[27,27, 'insert'], //     Code for insertions of residues        character
    [31,38, 'x'], //     X orthogonal Å coordinate    right    real (8.3)
    [39,46, 'y'], //     Y orthogonal Å coordinate    right    real (8.3)
    [47,54, 'z'], //     Z orthogonal Å coordinate    right    real (8.3)
    //[55,60,    'occupancy'], // Occupancy    right    real (6.2)
    [61,66,    'tempfac'] // Temperature factor    right    real (6.2)
    //[73,76,    'segid'], // Segment identifier¶    left    character
    //[77,78, 'elesym'], //     Element symbol    right    character
    ]; format.pop();                     // dummy to make ending , easier

    myxyz.prep();
    myxyz.addHeader(format.map(f => f[2]));

    // process the pdb file to get the data
    
    lines.forEach( l => {
        if (l.substr(0,4) !== 'ATOM') return;
        const d = [];
        format.forEach( f => {
            if (!f) return;  // final dummy one
            let v = l.substring(+f[0] - 1, f[1]).trim();
            d.push(v);
        });
        if (!(queryVariables.ca && d[1] !== 'CA'))
            myxyz.addRow(d);
    });

    // process the format and data to get the ranges
    // add our special colourby
    E.colourby.innerHTML += `<option value="pdbcol">pdbcol</option>`;


    // push data to main graphics
    // maingroup.remove(rlines);
    myxyz.finalize(fid);
    
    dataToMarkersGui();
    document.title = 'xyzviewer: ' + fid;
    return myxyz;
}
// var vdbReader = pdbReader;  // so we can read vdb files with same function

/**
Hydrogen = White.
Oxygen = Red.
Chlorine = Green.
Nitrogen = Blue.
Carbon = Grey.
Sulphur = Yellow.
Phosphorus = Orange.
Other = Varies - mostly Dark Red/Pink/Maroon.
**/
/** colour PDB data by conventional colours * /
function pdbcol(d) {
    const cols = { H: col3(1,1,1), O: col3(1,0,0), N: col3(0,0,1), C: col3(0.5,0.5,0.5), S: col3(1,1,0) };
    const col = cols[d.atname[0]];
    return col || col3(1,0,1);
}
******/

/** make graphics for chain as lines; this joins atoms in the order of the pdb file,  * NOT full pairs  
 * It can do sensible backbone if ca option is specified in queryVariables
 * TODO: if we want to use this seriously we need to keep additional information and make sensible chains
 * */
async function makechainlines(pfilterfun = E.filterbox.value) { // }, maxdsq = 80) {
    if (chainlines && chainlines.visible === false) return;
    if (!myxyz.namecols) return;
    const filterfun = await myxyz.makefilterfun(pfilterfun, E.filterbox);
    var geom = new THREE.Geometry;

    const linemat = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 1, linewidth: 1, vertexColors: true }); // THREE.VertexColors } );
    // maingroup.remove(chainlines);
    if (!chainlines) {
        chainlines = new THREE.LineSegments(geom, linemat);
        ggb.addToMain(chainlines, 'chainlines');
    }

    const xc = myxyz.namecols['x'], yc = myxyz.namecols['y'], zc = myxyz.namecols['z']; // , residc = myxyz.namecols['resid'];

    for (let i = 0; i < myxyz.n - 1; i++) {
        if (myxyz.val('chain', i) !== myxyz.val('chain', i+1)) continue;
        // patch missing data ... maybe clearer not to
        // if (residc[i] !== residc[i+1] && residc[i]+1 !== residc[i+1]) continue;
        // if ((xc[i]-xc[i+1])**2 + (xc[i]-xc[i+1])**2 + (xc[i]-xc[i+1])**2 > maxdsq) continue;

        myxyz._col.setRGB(0.3, 0.3, 0.3);
        if (filterfun) if (!filterfun(myxyz, i)) continue;
        const col1 = myxyz._col.clone();
        myxyz._col.setRGB(0.3, 0.3, 0.3);
        if (filterfun) if (!filterfun(myxyz, i+1)) continue;
        const col2 = myxyz._col.clone();

        geom.vertices.push(new THREE.Vector3(xc[i], yc[i], zc[i]));
        geom.vertices.push(new THREE.Vector3(xc[i+1], yc[i+1], zc[i+1]));
        geom.colors.push(col1);
        geom.colors.push(col2);
    }
    chainlines.geometry = geom;
}

