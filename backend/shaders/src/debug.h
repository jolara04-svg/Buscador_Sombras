#ifndef $DEBUG_H
#define $DEBUG_H
#include "includes.h"
#ifdef __cplusplus
extern "C"{
#endif
void dbg_setup(PyObject* pythonModule);
int dbg_renderCube();
#ifdef __cplusplus
}
#endif
#endif