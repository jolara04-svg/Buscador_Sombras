import { BufferGeometry, Matrix3, Matrix4, Mesh, Object3D, ShaderMaterial,  Vector3, Vector4 } from "three";

/*
 Struct for a surface were shadows can be casted.
 Can be interpreted both as a triangle and a paralelogram.
 */
type Sheet={
    b:Vector3;
    u:Vector3;
    w:Vector3;
};

type Uniforms={
    "shadowMatrix":{
        value:Matrix4
    },
    "sheetMatrix":{
        value:Matrix3
    },
    "light":{
        value:Vector3
    },
    "color":{
        value:Vector4
    }
};

type Defines={
    TRIANGLE:boolean,
    PARALELOGRAM:boolean
}

const pi180=Math.PI/180;

const placeholderSheet={
    b:new Vector3(0, 0, 0),
    u:new Vector3(1, 0, 0),
    w:new Vector3(0, 1, 0)
};

const vertexShader=`
uniform mat4 shadowMatrix;
uniform vec3 light;
varying float height;
varying vec3 floor;
void main(){
    vec4 pos=shadowMatrix*vec4(position.x, position.y, position.z, 1.0);
    height=pos.z;
    floor=vec3(pos.x, pos.y, 1.0);
    gl_Position=projectionMatrix*ModelViewMatrix*pos;
}
`;

const fragmentShader=`
uniform mat3 sheetMatrix;
uniform vec4 color;
varying float height;
varying vec3 floor;
void main(){
    if(height<=0.0)
        discard;
    #if TRIANGLE
    vec3 u=sheetMatrix*floor;
    if(u.x<0||u.y<0||u.x+u.y>1)
        discard;
    #endif
    #if PARALELOGRAM
    vec3 u=sheetMatrix*floor;
    if(u.x<0||u.y<0||u.x>1||u.y>1)
        discard;
    #endif
    gl_FragColor=color;
}
`;

const triangleDefines={
    TRIANGLE:true,
    PARALELOGRAM:false,
};

const paralelogramDefines={
    TRIANGLE:false,
    PARALELOGRAM:true
};

const noneDefines={
    TRIANGLE:false,
    PARALELOGRAM:false
};

const projectionMatrix=new Matrix4(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 1
);

function vecFromPolar(azimuth:number, elevation: number){
    return new Vector3(
        Math.cos(elevation)*Math.cos(azimuth),
        Math.cos(elevation)*Math.sin(azimuth),
        Math.sin(elevation)
    );
}

function vertexBaseChangeMatrix(sheet:Sheet, light:Vector3):Matrix4{
    const res=new Matrix4(
        sheet.u.x, sheet.w.x, light.x, sheet.b.x,
        sheet.u.y, sheet.w.y, light.y, sheet.b.y,
        sheet.u.z, sheet.w.z, light.z, sheet.b.z,
        0, 0, 0, 1
    );
    if(res.determinant()===0.0)
        throw new Error("light is parallel to sheet");
    return res;
}

function layerMatrix(layer:number):Matrix4{
    return new Matrix4(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 0, layer,
        0, 0, 0, 1
    );
}

function fragmentBaseChangeMatrix(sheet:Sheet):Matrix3{
    const res=new Matrix3(
        sheet.u.x, sheet.w.x, sheet.b.x,
        sheet.u.y, sheet.w.y, sheet.b.y,
        0, 0, 1
    );
    if(res.determinant()===0)
        throw new Error("sheet was degenerate");
    return res;
}

function formatUniforms(vertexMatrix:Matrix4, fragmentMatrix:Matrix3, light:Vector3, color:Vector4):Uniforms{
    return {
        "shadowMatrix":{value:vertexMatrix},
        "sheetMatrix":{value:fragmentMatrix},
        "light":{value:light},
        "color":{value:color}
    };
}

function getUniforms(sheet:Sheet, light:Vector3, layer:number, color:Vector4):Uniforms{
    const fragmentMatrix=fragmentBaseChangeMatrix(sheet).invert();
    const auxiliaryMatrix=vertexBaseChangeMatrix(sheet, light);
    const vertexMatrix=projectionMatrix.clone().multiply(auxiliaryMatrix.clone().invert());
    auxiliaryMatrix.multiply(vertexMatrix);
    vertexMatrix.multiplyMatrices(layerMatrix(layer), auxiliaryMatrix);
    return formatUniforms(vertexMatrix, fragmentMatrix, light, color);
}

function extractMeshes(obj:Object3D, geometries:BufferGeometry[]):void{
    const mesh:Mesh=obj as Mesh;
    if(mesh.isMesh)
        geometries.push(mesh.geometry);
    else
        obj.children.forEach((child)=>extractMeshes(child, geometries));
}

function extractGeometries(objs:Object3D[]):BufferGeometry[]{
    const geometries:BufferGeometry[]=[];
    objs.forEach((obj)=>extractMeshes(obj, geometries))
    return geometries;
}

function applyMaterial(geometries:BufferGeometry[], sheet:Sheet, light:Vector3, color:Vector4, layer:number, defines:Defines, meshes:Mesh[]):void{
    const material=new ShaderMaterial();
    try{
        material.uniforms=getUniforms(sheet, light, layer, color)
    }
    catch{
        return;
    }
    material.vertexShader=vertexShader;
    material.fragmentShader=fragmentShader;
    material.defines=defines;
    geometries.forEach((geometry)=>meshes.push(new Mesh(geometry, material)));
}

function applyMaterials(objs:Object3D[], triangles:Sheet[], paralelograms:Sheet[], azimuth:number, elevation:number, color:Vector4, layer:number):Mesh[]{
    const light:Vector3=vecFromPolar(pi180*azimuth, pi180*elevation);
    const geometries:BufferGeometry[]=extractGeometries(objs);
    const meshes:Mesh[]=[];
    triangles.forEach((sheet)=>applyMaterial(geometries, sheet, light, color, layer, triangleDefines, meshes));
    paralelograms.forEach((sheet)=>applyMaterial(geometries, sheet, light, color, layer, paralelogramDefines, meshes));
}

function applyMaterialsNone(objs:Object3D, azimuth:number, elevation:number, color:Vector4, layer:number):Mesh[]{
    const light:Vector3=vecFromPolar(pi180*azimuth, pi180*elevation);
    const geometries:BufferGeometry[]=extractGeometries(objs);
    const meshes:Mesh[]=[];
    applyMaterial(geometries, placeholderSheet, light, color, layer, noneDefines, meshes);
    return meshes;
}

export { applyMaterials, applyMaterialsNone, Sheet };