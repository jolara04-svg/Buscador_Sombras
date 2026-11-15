#ifndef $SHADOW_H
#define $SHADOW_H
#include "includes.h"
#ifdef __cplusplus
extern "C"{
#endif
typedef unsigned short ushort;
typedef float Vertex[3];
typedef ushort Triangle[3];
typedef struct{
    size_t refc;
    uint32_t vertex_count;
    uint32_t triangle_count;
    Vertex* vertices;
    Triangle* triangles;
}Model;
void incref(Model*);
void decref(Model*);
void setModule(PyObject*);
void setTask(double lon1, double lat1, double lon2, double lat2, double elev, double azim, size_t samples);
void cacheChunk(Model*);
void abortTask(void);
int getResult(double* result);
int getChunk(ushort* x, ushort* y);
int executeTask(void);
#ifdef __cplusplus 
}
#endif
#endif