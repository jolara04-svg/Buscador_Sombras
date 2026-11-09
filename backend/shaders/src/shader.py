import pygame
import numpy as np
from OpenGL import *
from OpenGL.GL import *
import ctypes
import cmodule

screen=pygame.display.set_mode((512,512),pygame.DOUBLEBUF|pygame.OPENGL)

with open(cmodule.getFilePath()+"/vertexShader.glsl") as file:
    vertexShaderSource=file.read()
with open(cmodule.getFilePath()+"/fragmentShader.glsl") as file:
    fragmentShaderSource=file.read()

vertexShader=glCreateShader(GL_VERTEX_SHADER)
glShaderSource(vertexShader, vertexShaderSource)
glCompileShader(vertexShader)
if not glGetShaderiv(vertexShader,GL_COMPILE_STATUS):
    print(glGetShaderInfoLog(vertexShader))
    raise ValueError("vertex shader failed to compile")

fragmentShader=glCreateShader(GL_FRAGMENT_SHADER)
glShaderSource(fragmentShader, fragmentShaderSource)
glCompileShader(fragmentShader)
if not glGetShaderiv(fragmentShader,GL_COMPILE_STATUS):
    print(glGetShaderInfoLog(fragmentShader))
    raise ValueError("fragment shader failed to compile")

program=glCreateProgram()
glAttachShader(program, vertexShader)
glAttachShader(program, fragmentShader)
glLinkProgram(program)
if not glGetProgramiv(program, GL_LINK_STATUS):
    print(glGetProgramInfoLog(program))
    raise ValueError("shader failed to link")

def debug_renderCube():
    _vertices=[-1, -1, -1, -1, -1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, -1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, 1, 1, 1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1]
    vertices=np.array(_vertices, np.float32)
    matrix=np.array([
        [0.5, 0, 0.5, 0],
        [0, 0.5, 0.5, 0],
        [0 , 0, 0, 0],
        [0, 0, 0, 1]
    ], dtype=np.float32)
    glClearColor(1.0, 1.0, 1.0, 1.0)
    glUseProgram(program)
    buffer=glGenBuffers(1)
    position=glGetAttribLocation(program, b"position\0")
    print("position=%d"%position)
    glBindBuffer(GL_ARRAY_BUFFER, buffer)
    glVertexAttribPointer(position, 3, GL_FLOAT, GL_FALSE, 0, None)
    glEnableVertexAttribArray(position)
    glBufferData(GL_ARRAY_BUFFER, vertices, GL_STATIC_DRAW)
    shadow=glGetUniformLocation(program, b"shadow\0")
    print("shadow=%d"%shadow)
    glUniformMatrix4fv(shadow, 1, GL_TRUE, matrix)
    glDrawArrays(GL_TRIANGLES, 0, len(_vertices)//3)
    pygame.display.flip()
    input()