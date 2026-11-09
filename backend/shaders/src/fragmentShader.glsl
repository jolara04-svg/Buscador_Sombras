varying float height;
void main(){
    if(height<=0.0) discard;
    gl_FragColor=vec4(1.0, 1.0, 1.0, 1.0);
}