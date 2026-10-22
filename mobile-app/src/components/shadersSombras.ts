import { Matrix4, Vector4, ShaderMaterial, DoubleSide } from "three";

const vertexShader=`
uniform mat4 shadowCastMatrix;
void main(){
    gl_Position=projectionMatrix*modelViewMatrix*shadowCastMatrix*vec4(position.x,position.y,position.z,1.0);
}
`;

const fragmentShader=`
uniform vec4 shadowColor;
void main(){
    gl_FragColor=shadowColor;
}
`;

const deg=Math.PI/180;

const buildingMatrix:Matrix4=new Matrix4(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
    0, 0, 0, 1
);

const shadowColor:Vector4=new Vector4(0, 0, 0, 1);
const buildingColor:Vector4=new Vector4(1, 0, 0, 1);

function getUniforms(shadowCastMatrix:Matrix4, color:Vector4){
    return {
        "shadowCastMatrix":{
            value:shadowCastMatrix
        },
        "shadowColor":{
            value:color
        }
    };
}

function getShadowCastMatrixRad(theta:number,phi:number):Matrix4{
    const tg=Math.tan(theta);
    return new Matrix4(
        1, 0, tg*Math.cos(phi), 0,
        0, 1, tg*Math.sin(phi), 0,
        0, 0, 0, 0,
        0, 0, 0, 1
    );
}

function getShadowCastMatrix(azimuth:number, elevation:number):Matrix4{
    return getShadowCastMatrixRad(90-deg*elevation, deg*azimuth);
}

function shadowShaderMaterialColor(azimuth:number, elevation:number, color:Vector4):ShaderMaterial{
    return new ShaderMaterial({
        uniforms:getUniforms(getShadowCastMatrix(azimuth,elevation), color),
        vertexShader:vertexShader,
        fragmentShader:fragmentShader,
        side:DoubleSide
    });
}

function shadowShaderMaterialDefault(azimuth:number, elevation:number){
    return shadowShaderMaterialColor(azimuth,elevation,shadowColor);
}

const buildingShaderMaterial:ShaderMaterial=new ShaderMaterial({
    uniforms:getUniforms(
        buildingMatrix,
        buildingColor
    ),
    vertexShader:vertexShader,
    fragmentShader:fragmentShader,
    side:DoubleSide
});

export{ vertexShader, fragmentShader };
export{ shadowColor, buildingColor };
export{ getUniforms, getShadowCastMatrixRad, getShadowCastMatrix };
export{ shadowShaderMaterialColor, shadowShaderMaterialDefault, buildingShaderMaterial };