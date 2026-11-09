attribute vec3 position;
uniform mat4 shadow;
varying float height;
void main(){
    vec4 finalPos=shadow*vec4(position.x, position.y, position.z, 1.0);
    gl_Position=finalPos;
    height=position.z;
}