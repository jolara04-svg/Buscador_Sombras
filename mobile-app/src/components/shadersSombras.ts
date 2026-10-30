import { Matrix4, Vector4, ShaderMaterial, DoubleSide } from "three";

const vertexShader=`
uniform mat4 shadowCastMatrix;
varying float height;
void main(){
    gl_Position=projectionMatrix*modelViewMatrix*shadowCastMatrix*vec4(position.x,position.y,position.z,1.0);
    height=position.z;
}
`;

const fragmentShader=`
uniform vec4 shadowColor;
varying float height;
void main(){
    if(height<=0.0)
        discard;
    gl_FragColor=shadowColor;
}
`;

const deg=Math.PI/180;

const shadowColor:Vector4=new Vector4(0, 0, 0, .5);
const buildingColor:Vector4=new Vector4(1, 0, 0, .5);
const transparentColor:Vector4=new Vector4(0, 0, 0, 0);

function buildingMatrix(x:number):Matrix4{
    return new Matrix4(
    x, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 2,
    0, 0, 0, 1
    );
}

function transparentMatrix(x:number):Matrix4{
    return new Matrix4(
    x, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 0.5,
    0, 0, 0, 1
    );
}

function getUniforms(shadowCastMatrix:Matrix4, color:Vector4){
    return {
        "shadowCastMatrix":{
            value:shadowCastMatrix
        },
        "shadowColor":{
            value:color.clone()
        }
    };
}

function getShadowCastMatrixRad(theta:number,phi:number,x:number):Matrix4{
    const tg=Math.tan(theta);
    return new Matrix4(
        x, 0, -tg*Math.sin(phi), 0,
        0, 1, -tg*Math.cos(phi), 0,
        0, 0, 0, 1,
        0, 0, 0, 1
    );
}

function getShadowCastMatrix(azimuth:number, elevation:number, x:number):Matrix4{
    return getShadowCastMatrixRad(deg*(90-Math.max(0.1, elevation)), deg*azimuth, x);
}

function shadowShaderMaterialColor(azimuth:number, elevation:number, color:Vector4,x:number):ShaderMaterial{
    return new ShaderMaterial({
        uniforms:getUniforms(getShadowCastMatrix(azimuth,elevation,x), color),
        vertexShader:vertexShader,
        fragmentShader:fragmentShader,
        side:DoubleSide,
        transparent:true
    });
}

function shadowShaderMaterialDefault(azimuth:number, elevation:number,x:number){
    return shadowShaderMaterialColor(azimuth,elevation,shadowColor,x);
}

function buildingShaderMaterial(x:number):ShaderMaterial{
    return new ShaderMaterial({
        uniforms:getUniforms(
            buildingMatrix(x),
            buildingColor
        ),
            vertexShader:vertexShader,
        fragmentShader:fragmentShader,
        side:DoubleSide,
        transparent:true
    });
}

function transparentShaderMaterial(x:number):ShaderMaterial{
    return new ShaderMaterial({
        uniforms:getUniforms(
            transparentMatrix(x),
            transparentColor
        ),
            vertexShader:vertexShader,
        fragmentShader:fragmentShader,
        side:DoubleSide
    });
}

export{ vertexShader, fragmentShader };
export{ shadowColor, buildingColor };
export{ getUniforms, getShadowCastMatrixRad, getShadowCastMatrix };
export{ shadowShaderMaterialColor, shadowShaderMaterialDefault, buildingShaderMaterial, transparentShaderMaterial };
